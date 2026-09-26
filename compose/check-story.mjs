#!/usr/bin/env node
/**
 * The story path of the front door: interiors, a questline and a game with it,
 * on an existing ready city. Prints the play URL.
 *
 * node compose/check-story.mjs <cityId> [baseUrl] [interiors] [sideJobs]
 */
import assert from 'node:assert/strict';
import { launcher } from './launcher.mjs';

const [ cityId, base = 'http://localhost:5306', interiors = '7', sideJobs = '2' ] = process.argv.slice( 2 );
assert.ok( cityId, 'usage: check-story.mjs <cityId> [baseUrl] [interiors] [sideJobs]' );
const api = launcher( base );

const opened = await api.stage( 'generateInstances', { cityId, mode: 'automatic', count: Number( interiors ), buildingIds: [] } );
const { instances } = opened.result;
assert.ok( instances.ids?.length >= 1, 'no interior was furnished' );
console.log( `ok interiors ${instances.ids.length}: ${instances.ids.join( ' ' )}, ${opened.seconds.toFixed( 1 )} s` );

const written = await api.stage( 'generateQuests', { cityId, interiorIds: instances.ids, mainBrief: '', sideJobs: Number( sideJobs ) } );
const { quests } = written.result;
assert.ok( quests?.id && quests.mainSteps > 0, 'no questline was generated' );
console.log( `ok story ${quests.id}: ${quests.mainSteps} main steps, ${quests.sideJobs} side jobs, ${written.seconds.toFixed( 1 )} s` );

const { game } = await api.call( 'createGame', { cityId, interiorIds: instances.ids, questId: quests.id } );
const saved = await api.call( 'exportGame', game.id );
assert.equal( saved.cityId, cityId );
assert.ok( saved.questBundle, 'the game carries no quest bundle' );
console.log( `ok game ${game.id}: ${instances.ids.length} interiors, quest ${quests.id}` );
const { playUrl } = await api.call( 'continueGame', game.id );
console.log( `play: ${new URL( playUrl, base )}` );
