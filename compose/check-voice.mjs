import assert from 'node:assert/strict';

// Speaks one fresh line through the voice box and measures it. Usage: node compose/check-voice.mjs [baseUrl]
const base = ( process.argv[ 2 ] ?? 'http://localhost:5308' ).replace( /\/$/, '' );
const RATE = 24000;

let health;
try {
	health = await ( await fetch( base + '/health', { signal: AbortSignal.timeout( 5000 ) } ) ).json();
} catch {
	console.log( `skip voice: nothing answers at ${base}; start it with COMPOSE_PROFILES=voice or docker compose --profile voice up -d` );
	process.exit( 0 );
}
assert.equal( health.status, 'ok', `voice health: ${JSON.stringify( health )}` );
assert.equal( health.sampleRate, RATE );

const speaker = { id: 'check-voice', gender: 'female', age: 41, traits: [ 'calm', 'helpful' ], category: 'transit' };
const pick = ( lo, hi ) => lo + Math.floor( Math.random() * ( hi - lo + 1 ) );
// A new line each run, so the check measures a render and not the cache.
const text = `Train ${pick( 100, 999 )} leaves from platform ${pick( 1, 12 )} in ${pick( 2, 15 )} minutes.`;
const request = () => fetch( base + '/v1/speak', {
	method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( { text, speaker } )
} );

const started = performance.now();
const response = await request();
assert.equal( response.status, 200, `speak: HTTP ${response.status}` );
assert.equal( response.headers.get( 'content-type' ), 'audio/wav' );
assert.equal( response.headers.get( 'x-voice-cache' ), 'miss', 'the fresh line came from the cache' );
const head = [];
let bytes = 0;
let firstAudio = null;
for await ( const piece of response.body ) {
	if ( bytes < 44 ) head.push( piece.subarray( 0, 44 - bytes ) );
	bytes += piece.byteLength;
	if ( firstAudio === null && bytes > 44 ) firstAudio = performance.now();
}
const seconds = ( performance.now() - started ) / 1000;
const header = Buffer.concat( head );
assert.equal( header.toString( 'ascii', 0, 4 ), 'RIFF' );
assert.equal( header.toString( 'ascii', 8, 16 ), 'WAVEfmt ' );
assert.deepEqual( [ header.readUInt16LE( 20 ), header.readUInt16LE( 22 ), header.readUInt32LE( 24 ), header.readUInt16LE( 34 ) ], [ 1, 1, RATE, 16 ], 'PCM16 mono 24 kHz' );
const audio = ( bytes - 44 ) / ( RATE * 2 );
assert.ok( audio > 0.5, `only ${audio.toFixed( 2 )} s of audio` );
const first = ( firstAudio - started ) / 1000;
const rtf = seconds / audio;
assert.ok( first < 2, `first audio after ${first.toFixed( 2 )} s` );
assert.ok( rtf < 1.5, `real-time factor ${rtf.toFixed( 2 )}` );

const replay = await request();
assert.equal( replay.headers.get( 'x-voice-cache' ), 'hit' );
assert.equal( Number( replay.headers.get( 'content-length' ) ), bytes );
await replay.arrayBuffer();
console.log( `ok  voice        first audio ${first.toFixed( 2 )} s, ${audio.toFixed( 2 )} s of audio in ${seconds.toFixed( 2 )} s (RTF ${rtf.toFixed( 2 )}), replay cached` );
