precision highp float;
uniform sampler2D tex;
uniform bool showGrid;
uniform bool showOpacity;
uniform float opacity;
varying vec2 uv;

vec4 checker3D(vec2 pos, vec2 size, vec4 color0, vec4 color1)
{
	float total = floor(pos.x*float(size.x)) +
					floor(pos.y*float(size.y));
	bool isEven = mod(total,2.0)==0.0;
	vec4 col1 = vec4(0.0,0.0,0.0,1.0);
	vec4 col2 = vec4(1.0,1.0,1.0,1.0);
	return (isEven) ? color0 : color1;
}

void main() {
	vec4 clr = texture2D(tex, uv);
	clr.a *= opacity;
	if (showGrid)
	{
		vec4 checker = checker3D( uv, vec2(200.0), 
								vec4(0.4), vec4(0.7));

		clr.rgb = (1.0-clr.a)*checker.rgb + clr.rgb*clr.a;
		clr.a = 1.0;
	}
	if (!showOpacity)
		clr.a = 1.0;

	gl_FragColor = clr;
}