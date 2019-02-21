precision highp float;

uniform float cameraNear;
uniform float cameraFar;

// #ifdef USE_LOGDEPTHBUF
	uniform float logDepthBufFC;
// #endif

uniform float radius;
// uniform bool onlyAO;
uniform vec2 size;
uniform float aoClamp;
// uniform float lumInfluence;
// uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
varying vec2 uv;

#define DL 2.399963229728653
#define EULER 2.718281828459045

const int SAMPLES = 32;//64;
const bool useNoise = true;
const float noiseAmount = 0.0004;
const float diffArea = 0.4;
const float gDisplace = 0.4;
// #include <packing>

vec2 rand( const vec2 coord ) 
{
	vec2 noise;
	if ( useNoise ) 
	{
		float nx = dot ( coord, vec2( 12.9898, 78.233 ) );
		float ny = dot ( coord, vec2( 12.9898, 78.233 ) * 2.0 );
		noise = clamp( fract ( 43758.5453 * sin( vec2( nx, ny ) ) ), 0.0, 1.0 );
	} 
	else 
	{
		float ff = fract( 1.0 - coord.s * ( size.x / 2.0 ) );
		float gg = fract( coord.t * ( size.y / 2.0 ) );
		noise = vec2( 0.25, 0.75 ) * vec2( ff ) + vec2( 0.75, 0.25 ) * gg;
	}
	return ( noise * 2.0  - 1.0 ) * noiseAmount;
}

float readDepth( const in vec2 coord ) 
{
		float z = /* unpackRGBAToDepth */( texture2D( tDepth, coord ).r );
	return z;
}

float compareDepths( const in float depth1, const in float depth2, inout int far ) 
{
	float garea = 8.0;
	float diff = ( depth1 - depth2 ) * 100.0;
	if ( diff < gDisplace ) 
	{
		garea = diffArea;
	}
	else 
	{
		far = 1;
	}
	float dd = diff - gDisplace;
	float gauss = pow( EULER, -2.0 * ( dd * dd ) / ( garea * garea ) );
	return gauss;
}

float calcAO( float depth, float dw, float dh ) 
{
	vec2 vv = vec2( dw, dh );
	vec2 coord1 = uv + radius * vv;
	vec2 coord2 = uv - radius * vv;
	float temp1 = 0.0;
	float temp2 = 0.0;
	int far = 0;
	temp1 = compareDepths( depth, readDepth( coord1 ), far );
	if ( far > 0 ) 
	{
		temp2 = compareDepths( readDepth( coord2 ), depth, far );
		temp1 += ( 1.0 - temp1 ) * temp2;
	}
	return temp1;
}

void main() 
{
	vec2 noise = rand( uv );
	float depth = readDepth( uv );
	float tt = clamp( depth, aoClamp, 1.0 );
	float w = ( 1.0 / size.x ) / tt + ( noise.x * ( 1.0 - noise.x ) );
	float h = ( 1.0 / size.y ) / tt + ( noise.y * ( 1.0 - noise.y ) );
	float ao = 0.0;
	float dz = 1.0 / float( SAMPLES );
	float l = 0.0;
	float z = 1.0 - dz / 2.0;
	for ( int i = 0; i <= SAMPLES; i ++ ) 
	{
		float r = sqrt( 1.0 - z );
		float pw = cos( l ) * r;
		float ph = sin( l ) * r;
		ao += calcAO( depth, pw * w, ph * h );
		z = z - dz;
		l = l + DL;
	}
	ao /= float( SAMPLES );
	gl_FragColor = vec4( vec3( ao ), 1.0 );
}