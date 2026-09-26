#!/usr/bin/env node
/**
 * The whole front door on one new game: a themed city named and built, its
 * interiors opened, a story written through the model server against them,
 * and the game made of it. Every stage runs as an Engine creation job; the
 * check prints each stage's seconds and the play URL, and asserts that the
 * shipped quest bundle agrees with itself and with the world.
 *
 * node compose/check-game.mjs <small|medium|large> [baseUrl] --theme "<city character>" --brief "<story premise>"
 *   [--interiors 9] [--side-jobs 3]
 */
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { launcher } from './launcher.mjs';

const USAGE = 'usage: check-game.mjs <small|medium|large> [baseUrl] --theme "<city character>" --brief "<story premise>" [--interiors 9] [--side-jobs 3]';
const { values, positionals } = parseArgs( {
	allowPositionals: true,
	options: {
		theme: { type: 'string' }, brief: { type: 'string' },
		interiors: { type: 'string', default: '9' }, 'side-jobs': { type: 'string', default: '3' }
	}
} );
const [ size, base = 'http://localhost:5306' ] = positionals;
assert.ok( [ 'small', 'medium', 'large' ].includes( size ) && values.theme?.trim() && values.brief?.trim(), USAGE );
const interiors = Number( values.interiors );
const sideJobs = Number( values[ 'side-jobs' ] );
const theme = values.theme.trim();
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

const { city } = await stage( 'city', 'generateCity', { size, theme } );
const cityRoot = `/out/cities/${city.id}`;
const cityManifest = await api.json( `${cityRoot}/manifest.json` );
assert.equal( cityManifest.named, true, 'the city is not named' );
assert.equal( cityManifest.namingTheme, theme, 'the city is named in another theme' );
const types = await api.json( `${cityRoot}/npc-types.json` );
assert.ok( types.types?.length > 0, 'the named city carries no NPC types' );
const atlas = await api.json( `${cityRoot}/blueprint.json` );
console.log( `ok city ${city.id}: ${city.buildingCount} buildings, ${atlas.parcels.filter( ( parcel ) => parcel.name ).length} named places, `
	+ `${types.types.length} NPC types, ${seconds.city.toFixed( 1 )} s` );

const { instances } = await stage( 'interiors', 'generateInstances', { cityId: city.id, mode: 'automatic', count: interiors, buildingIds: [] } );
const typeOf = new Map( atlas.parcels.map( ( parcel ) => [ parcel.id, parcel.type ] ) );
assert.ok( instances.ids.length >= 7, `only ${instances.ids.length} interiors opened` );
assert.ok( instances.ids.some( ( id ) => typeOf.get( id ) === 'residential' ), 'no home opened for the story' );
console.log( `ok interiors ${instances.ids.length}: ${instances.ids.map( ( id ) => `${id} ${typeOf.get( id )}` ).join( ', ' )}, ${seconds.interiors.toFixed( 1 )} s` );

const { quests } = await stage( 'story', 'generateQuests', { cityId: city.id, interiorIds: instances.ids, mainBrief: values.brief.trim(), sideJobs } );
assert.ok( quests.mainSteps >= 6, `the main story has ${quests.mainSteps} steps` );
const draft = `/out/drafts/${city.id}`;
const recording = await api.json( `${draft}/story/recording.json` );
const meta = await api.json( `${draft}/story/meta.json` );
assert.ok( typeof recording.model === 'string' && recording.model.length > 0, 'the recording names no model' );
console.log( `ok story ${quests.id}: ${quests.mainSteps} main steps, ${quests.sideJobs} side jobs, model ${recording.model}, `
	+ `${( meta.blocked ?? [] ).length} blocked, ${seconds.story.toFixed( 1 )} s` );

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
for ( const absent of [ 'story/recording.json', 'story/meta.json', 'quests/handoff-input.json', 'quests/all.questlines.json', 'draft.json' ] ) {

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
