import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = process.argv[ 2 ] ?? 'http://localhost:5306';
const hash = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
async function json( path ) {
	const response = await fetch( base + path );
	assert.ok( response.ok, `${path}: HTTP ${response.status}` );
	assert.match( response.headers.get( 'content-type' ), /application\/json/ );
	const bytes = Buffer.from( await response.arrayBuffer() );
	return { value: JSON.parse( bytes ), sha256: hash( bytes ) };
}
async function glb( path ) {
	const response = await fetch( base + path, { method: 'HEAD' } );
	assert.ok( response.ok && Number( response.headers.get( 'content-length' ) ) > 0, `Missing asset: ${path}` );
	assert.match( response.headers.get( 'content-type' ), /model\/gltf-binary/ );
}
const response = await fetch( base + '/api/launcher', {
	method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( { method: 'catalog' } )
} );
assert.ok( response.ok, `Catalog: HTTP ${response.status}` );
const catalog = await response.json();
assert.ok( Array.isArray( catalog.cities ) && Array.isArray( catalog.games ), 'Invalid catalog' );
for ( const [ kind, entries ] of [ [ 'cities', catalog.cities.filter( city => city.status === 'ready' ) ], [ 'games', catalog.games.filter( game => game.playable ) ] ] ) {
	for ( const entry of entries ) {
		const root = `/out/${kind}/${encodeURIComponent( entry.id )}`;
		const [ { value: manifest }, blueprint ] = await Promise.all( [ json( root + '/manifest.json' ), json( root + '/blueprint.json' ) ] );
		assert.deepEqual( [ ...manifest.parcels ].sort(), blueprint.value.parcels.map( parcel => parcel.id ).sort() );
		assert.equal( manifest.atlasVersion, blueprint.value.meta.version );
		assert.equal( manifest.connections.blueprintSha256, blueprint.sha256 );
		const connections = await json( root + '/' + manifest.connections.file );
		assert.equal( manifest.connections.sha256, connections.sha256 );
		let files = 0;
		for ( const id of manifest.parcels ) {
			await json( `${root}/${id}/${id}.blueprint.json` );
			await glb( `${root}/${id}/${id}.glb` ); files ++;
			for ( const floor of manifest.floors?.[ id ] ?? [] ) {
				await json( `${root}/${id}/interior/floors/${floor}.json` );
				await glb( `${root}/${id}/interior/floors/${floor}.glb` ); files ++;
			}
		}
		if ( kind === 'games' ) {
			const { value: game } = await json( root + '/game.json' );
			assert.deepEqual( [ ...game.selectedInteriors ].sort(), [ ...manifest.interiors ].sort() );
		}
		console.log( `ok ${kind}/${entry.id}: ${manifest.parcels.length} shells, ${manifest.interiors.length} interiors, ${files} GLBs` );
	}
}
console.log( `ok catalog: ${catalog.cities.length} cities, ${catalog.games.length} games` );
