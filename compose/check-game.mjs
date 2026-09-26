#!/usr/bin/env node
/**
 * The whole creation flow on one new game, with names and a story authored
 * outside the engine: a city planned, built from the plan as an author named
 * it, its interiors opened, a pre-authored Quests recording imported against
 * them, and the game made of it. Every stage runs as an Engine creation job;
 * no stage asks a model. The check prints each stage's seconds and the play
 * URL, and asserts that the shipped quest bundle agrees with itself and with
 * the world.
 *
 * node compose/check-game.mjs <small|medium|large> [baseUrl] --recording <dir>
 *   [--named <dir> --seed <seed>] [--name <city name>] [--interiors 9] [--side-jobs 3]
 *
 * --recording is a Quests recording directory (recording.json). --named holds
 * the plan as the Naming box names it, blueprint.named.json and npc-types.json,
 * named from the plan Atlas makes of <size> and --seed. Both are paths Engine
 * resolves against its checkout, e.g. ../quests/creation/samples/urbe-small.
 */
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { launcher } from './launcher.mjs';

const USAGE = 'usage: check-game.mjs <small|medium|large> [baseUrl] --recording <dir> [--named <dir> --seed <seed>] [--name <city name>] [--interiors 9] [--side-jobs 3]';
const { values, positionals } = parseArgs( {
	allowPositionals: true,
	options: {
		recording: { type: 'string' }, named: { type: 'string' }, seed: { type: 'string' }, name: { type: 'string' },
		interiors: { type: 'string', default: '9' }, 'side-jobs': { type: 'string', default: '3' }
	}
} );
const [ size, base = 'http://localhost:5306' ] = positionals;
assert.ok( [ 'small', 'medium', 'large' ].includes( size ) && values.recording && ( ! values.named || values.seed ), USAGE );
const interiors = Number( values.interiors );
const sideJobs = Number( values[ 'side-jobs' ] );
const named = values.named ? { blueprint: `${values.named}/blueprint.named.json`, types: `${values.named}/npc-types.json` } : null;
const api = launcher( base );
const seconds = {};

/** Runs one stage, telling how long it has been running once a minute. */
async function stage( name, method, input ) {

	let told = 0;
	const { result, seconds: took } = await api.stage( method, input, {
		onPoll: ( job, elapsed ) => {

			if ( elapsed - told < 60 ) return;
			told = elapsed;
			console.log( `.. ${name} ${job.state}, ${Math.round( elapsed )} s${job.progress ? `: ${job.progress.slice( 0, 160 )}` : ''}` );

		}
	} );
	seconds[ name ] = took;
	return result;

}

const { plan } = await stage( 'plan', 'planCity', {
	size, ...( values.seed ? { seed: values.seed } : {} ), ...( values.name ? { name: values.name } : {} )
} );
assert.equal( plan.size, size );
console.log( `ok plan ${plan.id}: seed ${plan.seed}, ${Object.values( plan.stats.parcelCounts ).reduce( ( sum, count ) => sum + count, 0 )} parcels, `
	+ `population ${plan.stats.population}, ${seconds.plan.toFixed( 1 )} s` );

const { city } = await stage( 'build', 'buildCity', { cityId: plan.id, ...( named ? { named } : {} ) } );
const cityRoot = `/out/cities/${city.id}`;
const cityManifest = await api.json( `${cityRoot}/manifest.json` );
const atlas = await api.json( `${cityRoot}/blueprint.json` );
assert.equal( atlas.meta.seed, plan.seed, 'the city is not built from its plan' );
assert.equal( cityManifest.named, Boolean( named ), named ? 'the city is not named' : 'an unnamed plan came out named' );
assert.equal( await api.served( `/out/plans/${plan.id}/plan.json` ), false, 'the plan stays after its city stands' );
let types = null;
if ( named ) {

	assert.equal( cityManifest.namingTheme, atlas.meta.naming?.theme, 'the city is named in another theme' );
	types = await api.json( `${cityRoot}/npc-types.json` );
	assert.ok( types.types?.length > 0, 'the named city carries no NPC types' );

}
console.log( `ok city ${city.id}: ${city.buildingCount} buildings, ${atlas.parcels.filter( ( parcel ) => parcel.name ).length} named places, `
	+ `${types ? `${types.types.length} NPC types, theme "${cityManifest.namingTheme}"` : 'unnamed'}, ${seconds.build.toFixed( 1 )} s` );

const { instances } = await stage( 'interiors', 'generateInstances', { cityId: city.id, mode: 'automatic', count: interiors, buildingIds: [] } );
const typeOf = new Map( atlas.parcels.map( ( parcel ) => [ parcel.id, parcel.type ] ) );
assert.ok( instances.ids.length >= 7, `only ${instances.ids.length} interiors opened` );
if ( named ) assert.ok( instances.ids.some( ( id ) => typeOf.get( id ) === 'residential' ), 'no home opened for the story' );
console.log( `ok interiors ${instances.ids.length}: ${instances.ids.map( ( id ) => `${id} ${typeOf.get( id )}` ).join( ', ' )}, ${seconds.interiors.toFixed( 1 )} s` );

const { quests } = await stage( 'story', 'importStory', { cityId: city.id, recording: values.recording, sideJobs } );
assert.ok( quests.mainSteps >= 6, `the main story has ${quests.mainSteps} steps` );
const draft = `/out/drafts/${city.id}`;
const recording = await api.json( `${draft}/story/recording.json` );
const leftOut = await api.json( `${draft}/story/left-out.json` );
const replayed = await api.json( `${draft}/quests/questlines.meta.json` );
console.log( `ok story ${quests.id}: ${quests.mainSteps} main steps, ${quests.sideJobs} side jobs, recorded by ${recording.model ?? 'an unnamed author'}, `
	+ `${( replayed.blocked ?? [] ).length + leftOut.length} left out${[ ...( replayed.blocked ?? [] ), ...leftOut ].map( ( entry ) => `; ${entry.questlineId ?? entry.questId}: ${entry.reason}` ).join( '' )}, `
	+ `${seconds.story.toFixed( 1 )} s` );

const { game } = await stage( 'game', 'createGame', { cityId: city.id, interiorIds: instances.ids, questId: quests.id } );
const root = `/out/games/${game.id}`;
const saved = await api.call( 'exportGame', game.id );
assert.ok( saved.questBundle, 'the game carries no quest bundle' );
assert.deepEqual( [ ...saved.selectedInteriors ].sort(), [ ...instances.ids ].sort() );
const manifest = await api.json( `${root}/quests/quest-bundle.json` );
const bundle = Object.fromEntries( await Promise.all( Object.entries( manifest.files ).map( async ( [ name, file ] ) => [
	name, await api.json( `${root}/quests/${file}` )
] ) ) );
for ( const [ name, count ] of Object.entries( manifest.counts ) ) {

	assert.equal( bundle[ name ].length, count, `${manifest.files[ name ]} holds ${bundle[ name ].length} records, the manifest counts ${count}` );

}
assert.equal( bundle.questlines.length, 1 + quests.sideJobs );
assert.equal( saved.quests.length + saved.sideJobs.length, bundle.questlines.length );
const questIds = new Set( bundle.questlines.map( ( definition ) => definition.id ) );
const opened = new Set( instances.ids );
const places = parcelIds( bundle.questlines );
assert.deepEqual( places.filter( ( id ) => ! opened.has( id ) ), [], 'a quest names a building that did not open' );
for ( const name of [ 'objectives', 'investigations', 'mechanicTargetBindings', 'missionItemBindings', 'scenery' ] ) {

	for ( const record of bundle[ name ] ?? [] ) assert.ok( questIds.has( record.questId ), `${name} names quest ${record.questId}, which the game does not carry` );

}
const assets = new Set( bundle.missionAssetRequests.map( ( request ) => request.assetId ) );
for ( const binding of bundle.missionItemBindings ) assert.ok( assets.has( binding.assetId ), `item ${binding.itemId} is bound to an asset nobody requests` );
for ( const spec of bundle.scenery ?? [] ) assert.ok( opened.has( spec.place.parcelId ), `scene ${spec.sceneId} stands in ${spec.place.parcelId}, which did not open` );
assert.ok( bundle.hostCapabilities.scenery, 'the game declares no scenery' );
const kinds = [ ...new Set( bundle.questlines.flatMap( ( definition ) => definition.steps.map( ( step ) => step.target.kind ) ) ) ];
for ( const absent of [ 'story/recording.json', 'story/left-out.json', 'quests/handoff-input.json', 'quests/all.questlines.json', 'draft.json' ] ) {

	assert.equal( await api.served( `${root}/${absent}` ), false, `the game ships ${absent}` );

}
console.log( `ok game ${game.id}: ${bundle.questlines.length} questlines, ${bundle.objectives.length} objectives, `
	+ `${( bundle.scenery ?? [] ).length} scenes, ${bundle.investigations.length} investigations, step kinds ${kinds.join( ', ' )}, `
	+ `${places.length} places, ${seconds.game.toFixed( 1 )} s` );

const { playUrl } = await api.call( 'continueGame', game.id );
console.log( `seconds: ${Object.entries( seconds ).map( ( [ name, value ] ) => `${name} ${value.toFixed( 1 )}` ).join( ', ' )}, `
	+ `total ${Object.values( seconds ).reduce( ( sum, value ) => sum + value, 0 ).toFixed( 1 )}` );
console.log( `play: ${new URL( playUrl, base )}` );

/** Every building a quest names, in first mention order. */
function parcelIds( value, ids = new Set() ) {

	if ( Array.isArray( value ) ) value.forEach( ( entry ) => parcelIds( entry, ids ) );
	else if ( value && typeof value === 'object' ) {

		for ( const [ key, entry ] of Object.entries( value ) ) {

			if ( ( key === 'parcelId' || key === 'atParcelId' ) && typeof entry === 'string' ) ids.add( entry );
			else parcelIds( entry, ids );

		}

	}
	return [ ...ids ];

}
