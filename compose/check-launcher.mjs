import assert from 'node:assert/strict';

const size = process.argv[ 2 ] ?? 'small';
const base = process.argv[ 3 ] ?? 'http://localhost:5306';
assert.ok( [ 'small', 'medium', 'large' ].includes( size ), 'size must be small, medium or large' );

async function call( method, input ) {

	const response = await fetch( `${base}/api/launcher`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { method, ...( input === undefined ? {} : { input } ) } )
	} );
	const result = await response.json();
	assert.ok( response.ok, `${method}: ${result.message ?? response.status}` );
	return result;

}

async function document( path ) {

	const response = await fetch( base + path );
	assert.ok( response.ok, `${path}: HTTP ${response.status}` );
	assert.match( response.headers.get( 'content-type' ), /application\/json/ );
	return response.json();

}

const started = performance.now();
const { city } = await call( 'generateCity', { size } );
assert.equal( city.status, 'ready' );
assert.equal( city.size, size );
assert.ok( city.buildingCount > 0 && city.seed && city.name );
console.log( `ok city ${city.id}: ${city.buildingCount} shells, ${((performance.now() - started) / 1000).toFixed( 1 )} s` );

const { game } = await call( 'createGame', { cityId: city.id, interiorIds: [], questId: null } );
const path = `/out/games/${game.id}`;
const saved = await call( 'exportGame', game.id );
assert.equal( saved.cityId, city.id );
assert.equal( saved.questBundle, null );
assert.deepEqual( [ saved.selectedInteriors, saved.quests, saved.sideJobs ], [ [], [], [] ] );
const manifest = await document( `${path}/manifest.json` );
const atlas = await document( `${path}/blueprint.json` );
assert.deepEqual( manifest.interiors, [] );
assert.deepEqual( [...manifest.parcels].sort(), atlas.parcels.map( parcel => parcel.id ).sort() );
for ( const id of manifest.parcels ) {

	await document( `${path}/${id}/${id}.blueprint.json` );
	const response = await fetch( `${base}${path}/${id}/${id}.glb`, { method: 'HEAD' } );
	assert.ok( response.ok && ! response.headers.get( 'content-type' )?.includes( 'text/html' ), `missing shell ${id}` );

}
console.log( `ok game ${game.id}: complete exteriors, no interiors or quests` );

const next = await call( 'saveCurrent', {
	gameId: game.id, expectedRevision: saved.save.revision, updatedAt: new Date().toISOString(),
	playTimeSeconds: saved.save.playTimeSeconds + 1,
	player: { ...saved.player, heading: 0.5 }, quests: [], sideJobs: [],
	currentLocation: saved.currentLocation, discoveredLocations: saved.discoveredLocations
} );
assert.equal( next.save.revision, saved.save.revision + 1 );
assert.deepEqual( await document( `${path}/game.json` ), next );
const { playUrl } = await call( 'continueGame', game.id );
const query = new URL( playUrl, base ).searchParams;
assert.equal( query.get( 'game' ), game.id );
assert.equal( query.get( 'mode' ), 'game' );
assert.ok( (await call( 'catalog' )).games.some( entry => entry.id === game.id ) );
console.log( `ok save and resume: ${new URL( playUrl, base )}` );
