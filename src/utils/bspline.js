'use strict'


function interpolate(t, degree, points, knots, weights, result) 
{

	var i,j,s,l;              // function-scoped iteration variables
	var n = points.length;    // points count
	var d = points[0].length; // point dimensionality
	
	if(degree < 1) throw new Error('degree must be at least 1 (linear)');
	if(degree > (n-1)) throw new Error('degree must be less than or equal to point count - 1');
	
	if(!weights) {
		// build weight vector of length [n]
		weights = [];
		for(i=0; i<n; i++) {
			weights[i] = 1;
		}
	}
	
	if(!knots) {
		// build knot vector of length [n + degree + 1]
		knots = [];
		for(i=0; i<n+degree+1; i++) {
			knots[i] = i;
		}
	} else {
		if(knots.length !== n+degree+1) throw new Error('bad knot vector length');
	}
	
	var domain = [
		degree,
		knots.length-1 - degree
	];
	
	// remap t to the domain where the spline is defined
	var low  = knots[domain[0]];
	var high = knots[domain[1]];
	t = t * (high - low) + low;
	
	if(t < low || t > high) throw new Error('out of bounds');
	
	// find s (the spline segment) for the [t] value provided
	for(s=domain[0]; s<domain[1]; s++) {
		if(t >= knots[s] && t <= knots[s+1]) {
			break;
		}
	}
	
	// convert points to homogeneous coordinates
	var v = [];
	for(i=0; i<n; i++) {
		v[i] = [];
		for(j=0; j<d; j++) {
			v[i][j] = points[i][j] * weights[i];
		}
		v[i][d] = weights[i];
	}
	
	// l (level) goes from 1 to the curve degree + 1
	var alpha;
	for(l=1; l<=degree+1; l++) {
		// build level l of the pyramid
		for(i=s; i>s-degree-1+l; i--) {
			alpha = (t - knots[i]) / (knots[i+degree+1-l] - knots[i]);
		
			// interpolate each component
			for(j=0; j<d+1; j++) {
				v[i][j] = (1 - alpha) * v[i-1][j] + alpha * v[i][j];
			}
		}
	}
	
	// convert back to cartesian and return
	var result = result || [];
	for(i=0; i<d; i++) {
		result[i] = v[s][i] / v[s][d];
	}
	
	return result;
}


function bsplinePolyline(count, degree, points, knots) //, weights) weights == 1
{

	var i,j,s,l;              // function-scoped iteration variables
	var n = points.length;    // points count
	var d = 2;//points[0].length; // point dimensionality
	
	if(degree < 1) throw new Error('degree must be at least 1 (linear)');
	if(degree > (n-1)) throw new Error('degree must be less than or equal to point count - 1');
	
	// if(!weights) {
	// 	// build weight vector of length [n]
	// 	weights = [];
	// 	for(i=0; i<n; i++) 
	// 	{
	// 		weights[i] = 1;
	// 	}
	// }
	
	if(!knots) 
	{
		// build knot vector of length [n + degree + 1]
		knots = [];
		for(i=0; i<n+degree+1; i++) 
		{
			knots[i] = i;
		}
	} 
	else
	 {
		if(knots.length !== n+degree+1) throw new Error('bad knot vector length');
	}
	
	var domain = [
		degree,
		knots.length-1 - degree
	];
		
	// convert points to homogeneous coordinates
	var v = [];
	// for(i=0; i<n; i++) 
	// {
	// 	v[i] = [];
	// 	for(j=0; j<d; j++) 
	// 	{
	// 		v[i][j] = points[i][j] * weights[i];
	// 	}
	// 	v[i][d] = weights[i];
	// }

	var low  = knots[domain[0]];
	var high = knots[domain[1]];

	var div_count = 1.0 / (count-1);
	// remap t to the domain where the spline is defined
	var intervals = Array(count).fill().map( (_, i)=> (i * div_count) * (high - low) + low  )

	// t = t * (high - low) + low;
	// if(t < low || t > high) throw new Error('out of bounds');
	
	// // find s (the spline segment) for the [t] value provided
	// for(s=domain[0]; s<domain[1]; s++) 
	// {
	// 	if(t >= knots[s] && t <= knots[s+1]) 
	// 	{
	// 		break;
	// 	}
	// }
	
	// l (level) goes from 1 to the curve degree + 1
	var alpha;
	var result = [];
	var t, m;
	m = 0;
	// find s (the spline segment) for the [t] value provided
	for(s=domain[0]; s<domain[1]; s++) 
	{
		while(m < intervals.length &&
			intervals[m] >= knots[s] && intervals[m] <= knots[s+1]) 
		{
			t = intervals[m]
			let pt = Array(s+1).fill({x:0, y:0})
			for(l=1; l<=degree+1; l++) 
			{
				// build level l of the pyramid
				for(i=s; i>s-degree-1+l; i--) 
				{
					alpha = (t - knots[i]) / (knots[i+degree+1-l] - knots[i]);
				
					// interpolate each component
					// for(j=0; j<d+1; j++) 
					// {
					// 	pt[i][j] = (1 - alpha) * v[i-1][j] + alpha * v[i][j];
					// }
					pt[i].x = (1 - alpha) * points[i-1].x + alpha * points[i].x;
					pt[i].y = (1 - alpha) * points[i-1].y + alpha * points[i].y;
				}
			}
			if (pt[s])
				result.push(pt[s])

			m++;
		}
	}
	
	// // convert back to cartesian and return
	// // var result = result || [];
	// for(i=0; i<d; i++) 
	// {
	// 	result[i] = v[s][i];// / v[s][d];
	// }
	
	return result;
}



// module.exports = bsplinePolyline;
export default bsplinePolyline;