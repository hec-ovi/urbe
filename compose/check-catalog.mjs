import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openWorldArchive } from '../engine/src/world-archive/browser.js';

const base = process.argv[ 2 ] ?? 'http://localhost:5306';
const hash = bytes => createHash( 'sha256' ).update( bytes ).digest( 'hex' );
async function parallel( values, action ) {
	let next = 0;
	await Promise.all( Array.from( { length: 8 }, async () => {
		while ( next < values.length ) await action( values[ next ++ ] );
	} ) );
}
async function json( path ) {
	const response = await fetch( base + path );
	assert.ok( response.ok, `${path}: HTTP ${response.status}` );
	assert.match( response.headers.get( 'content-type' ), /application\/json/ );
	const bytes = Buffer.from( await response.arrayBuffer() );
	return { value: JSON.parse( bytes ), sha256: hash( bytes ) };
}
async function asset( path, type ) {
	const response = await fetch( base + path, { method: 'HEAD' } );
	assert.ok( response.ok && Number( response.headers.get( 'content-length' ) ) > 0, `Missing asset: ${path}` );
	assert.ok( response.headers.get( 'content-type' )?.split( ';' )[ 0 ] === type, `Wrong asset type: ${path}` );
}
async function archive( root, reference ) {
	const path = root + '/' + reference.file;
	const index = await json( path );
	assert.equal( index.sha256, reference.sha256, `${path}: index hash` );
	const reader = await openWorldArchive( base + path );
	const directory = path.slice( 0, path.lastIndexOf( '/' ) + 1 );
	const parts = new Map( reader.index.collections.flatMap( collection => collection.parts.map( part => [ part.file, part ] ) ) );
	await parallel( [ ...parts.values() ], async part => {
		const response = await fetch( base + directory + part.file );
		assert.ok( response.ok, `${part.file}: HTTP ${response.status}` );
		assert.match( response.headers.get( 'content-type' ), /application\/json/ );
		const digest = createHash( 'sha256' );
		let bytes = 0;
		for await ( const piece of response.body ) { digest.update( piece ); bytes += piece.byteLength; }
		assert.equal( bytes, part.bytes, `${part.file}: byte count` );
		assert.equal( digest.digest( 'hex' ), part.sha256, `${part.file}: hash` );
	} );
	return { ...index, reader };
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
		const { value: manifest } = await json( root + '/manifest.json' );
		const blueprint = manifest.blueprint ? await archive( root, manifest.blueprint ) : await json( root + '/blueprint.json' );
		const atlas = blueprint.reader ? {
			meta: blueprint.reader.index.root.meta, parcels: await blueprint.reader.readCollection( '/parcels' )
		} : blueprint.value;
		// Every plan parcel stands, or is an empty lot a merge took, which nothing is fetched for.
		const standing = atlas.parcels.map( parcel => parcel.id ).filter( id => manifest.sources?.[ id ] !== 'empty' );
		assert.deepEqual( [ ...manifest.parcels ].sort(), standing.sort() );
		assert.equal( manifest.atlasVersion, atlas.meta.version );
		assert.equal( manifest.connections.blueprintSha256, blueprint.sha256 );
		const connections = manifest.connections.encoding === 'archive'
			? await archive( root, manifest.connections ) : await json( root + '/' + manifest.connections.file );
		assert.equal( manifest.connections.sha256, connections.sha256 );
		const source = connections.reader ? connections.reader.index.root : connections.value;
		assert.equal( source.meta.seed, atlas.meta.seed );
		assert.equal( source.meta.atlasSeed, atlas.meta.seed );
		let files = 0;
		await parallel( manifest.parcels, async id => {
			// A kit parcel stands on a shared plan and ships only the record naming it.
			if ( manifest.sources?.[ id ] === 'kit' ) await asset( `${root}/${id}/${id}.placements.json`, 'application/json' );
			else {
				await asset( `${root}/${id}/${id}.blueprint.json`, 'application/json' );
				await asset( `${root}/${id}/${id}.glb`, 'model/gltf-binary' ); files ++;
			}
			// A furnished building is JSON alone: its floors name the layouts it publishes,
			// and its geometry is the shared module set.
			if ( manifest.interiors.includes( id ) ) {
				const { value: building } = await json( `${root}/${id}/interior/building.json` );
				const tag = index => `${index < 0 ? '-' : ''}${String( Math.abs( index ) ).padStart( 3, '0' )}`;
				assert.deepEqual( building.floors.map( floor => floor.index ).sort( ( a, b ) => a - b ).map( tag ), manifest.floors[ id ], `${id}: interior floors` );
				await asset( `${root}/${id}/interior/npc.json`, 'application/json' );
				for ( const file of new Set( Object.values( building.layouts ) ) ) await asset( `${root}/${id}/interior/${file}`, 'application/json' );
			}
		} );
		if ( kind === 'games' ) {
			const { value: game } = await json( root + '/game.json' );
			assert.deepEqual( [ ...game.selectedInteriors ].sort(), [ ...manifest.interiors ].sort() );
		}
		console.log( `ok ${kind}/${entry.id}: ${manifest.parcels.length} buildings, ${manifest.interiors.length} interiors, ${files} shell GLBs` );
	}
}
console.log( `ok catalog: ${catalog.cities.length} cities, ${catalog.games.length} games` );
