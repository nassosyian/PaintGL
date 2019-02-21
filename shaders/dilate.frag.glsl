precision highp float;

varying vec2 uv;
uniform vec2 step;
uniform sampler2D tex;
uniform sampler2D geoMaskTex;
uniform bool useGeoMask;

vec4 gather(vec2 st)
{
	float scale;
	vec4 tmpClr;
	if (useGeoMask)		scale = texture2D(geoMaskTex, st).r > 0.0 ? 1.0 : 0.0;
	else				scale = 1.0;
	tmpClr = texture2D(tex, st)*scale;
	return tmpClr;
}

void main() 
{
	vec4 clr = texture2D(tex, uv);
	bool outsideMask = useGeoMask ? (texture2D(geoMaskTex, uv).r < 1.0) : true;
	// bool outsideMask = useGeoMask ? !(texture2D(geoMaskTex, uv).r > 0.0) : true;
	vec2 st;
	float scale;
	vec4 tmpClr;
	bool expanded = false;
	int count = 0;

	// for all the pixels outside the geomask...
	if (outsideMask && clr.a == 0.0)
	{
		count = 0;
		clr = vec4(0.0);
		vec2 from = uv - step;
		for (float i = 0.0; i < 3.0; i += 1.0)
		{
			for (float j = 0.0; j < 3.0; j += 1.0)
			{
				// gather color from inside the geomask...
				st = vec2(from.x+step.x*i, from.y+step.y*j);
				tmpClr = gather(st);
				clr += tmpClr;
				if (tmpClr.a > 0.0)	count++;
			}
		}
		if (count > 0)	clr /= float(count);
		expanded = true;
	}
	if (outsideMask && clr.a == 0.0)
	{
		count = 0;
		clr = vec4(0.0);
		vec2 from = uv - step*2.0;
		for (float i = 0.0; i < 5.0; i += 1.0)
		{
			for (float j = 0.0; j < 5.0; j += 1.0)
			{
				st = vec2(from.x+step.x*i, from.y+step.y*j);
				tmpClr = gather(st);
				clr += tmpClr;
				if (tmpClr.a > 0.0)	count++;
			}
		}
		if (count > 0)	clr /= float(count);
		expanded = true;
	}
	if (outsideMask && clr.a == 0.0)
	{
		count = 0;
		clr = vec4(0.0);
		vec2 from = uv - step*3.0;
		for (float i = 0.0; i < 7.0; i += 1.0)
		{
			for (float j = 0.0; j < 7.0; j += 1.0)
			{
				st = vec2(from.x+step.x*i, from.y+step.y*j);
				tmpClr = gather(st);
				clr += tmpClr;
				if (tmpClr.a > 0.0)	count++;
			}
		}
		if (count > 0)	clr /= float(count);
		expanded = true;
	}
	if (outsideMask && clr.a == 0.0)
	{
		count = 0;
		clr = vec4(0.0);
		vec2 from = uv - step*4.0;
		for (float i = 0.0; i < 9.0; i += 1.0)
		{
			for (float j = 0.0; j < 9.0; j += 1.0)
			{
				st = vec2(from.x+step.x*i, from.y+step.y*j);
				tmpClr = gather(st);
				clr += tmpClr;
				if (tmpClr.a > 0.0)	count++;
			}
		}
		if (count > 0)	clr /= float(count);
		expanded = true;
	}
	if (outsideMask && clr.a == 0.0)
	{
		count = 0;
		clr = vec4(0.0);
		vec2 from = uv - step*5.0;
		for (float i = 0.0; i < 11.0; i += 1.0)
		{
			for (float j = 0.0; j < 11.0; j += 1.0)
			{
				st = vec2(from.x+step.x*i, from.y+step.y*j);
				tmpClr = gather(st);
				clr += tmpClr;
				if (tmpClr.a > 0.0)	count++;
			}
		}
		if (count > 0)	clr /= float(count);
		expanded = true;
	}
	{
		gl_FragColor = clr;
	}

}