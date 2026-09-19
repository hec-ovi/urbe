#!/usr/bin/env node
/**
 * The story path of the front door: interiors, a questline and a game with it,
 * on an existing ready city. Prints the play URL.
 *
 * node compose/check-story.mjs <cityId> [baseUrl] [interiors] [sideJobs]
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const [ cityId, base = 'http://localhost:5306', interiors = '7', sideJobs = '2' ] = process.argv.slice( 2 );
assert.ok( cityId, 'usage: check-story.mjs <cityId> [baseUrl] [interiors] [sideJobs]' );

async function call( method, input ) {

	const response = await fetch( `${base}/api/launcher`, {
		method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify( { method, input } )
	} );
	const result = await response.json();
	assert.ok( response.ok, `${method}: ${result.message ?? response.status}` );
	return result;

}

let started = performance.now();
const { instances } = await call( 'generateInstances', { cityId, mode: 'automatic', count: Number( interiors ), buildingIds: [] } );
assert.ok( instances.ids?.length >= 1, 'no interior was furnished' );
console.log( `ok interiors ${instances.ids.length}: ${instances.ids.join( ' ' )}, ${( ( performance.now() - started ) / 1000 ).toFixed( 1 )} s` );

started = performance.now();
const { quests } = await call( 'generateQuests', { cityId, interiorIds: instances.ids, mainBrief: '', sideJobs: Number( sideJobs ) } );
const main = quests.main ?? quests.questlines?.[ 0 ] ?? quests[ 0 ];
assert.ok( main?.id, 'no questline was generated' );
console.log( `ok story ${main.id} "${main.title ?? main.name ?? ''}" with ${quests.sideJobs?.length ?? quests.side?.length ?? '?'} side jobs, ${( ( performance.now() - started ) / 1000 ).toFixed( 1 )} s` );

const { game } = await call( 'createGame', { cityId, interiorIds: instances.ids, questId: main.id } );
const saved = await call( 'exportGame', game.id );
assert.equal( saved.cityId, cityId );
assert.ok( saved.questBundle, 'the game carries no quest bundle' );
console.log( `ok game ${game.id}: ${instances.ids.length} interiors, quest ${main.id}` );
console.log( `play: ${base}${game.playUrl ?? `/?mode=game&game=${game.id}&out=%2Fout%2Fgames%2F${game.id}`}` );
