/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

THREE.OrbitControls = function ( object, domElement ) {

	this.object = object;

	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the object orbits around
	this.target = new THREE.Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	// How far you can orbit horizontally, upper and lower limits.
	// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.25;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// Set to false to disable panning
	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = false; // if true, pan in screen-space
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	//
	// public methods
	//

	this.getPolarAngle = function () {

		return spherical.phi;

	};

	this.getAzimuthalAngle = function () {

		return spherical.theta;

	};

	this.saveState = function () {

		scope.target0.copy( scope.target );
		scope.position0.copy( scope.object.position );
		scope.zoom0 = scope.object.zoom;

	};

	this.reset = function () {

		scope.target.copy( scope.target0 );
		scope.object.position.copy( scope.position0 );
		scope.object.zoom = scope.zoom0;

		scope.object.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );

		scope.update();

		state = STATE.NONE;

	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {

		var offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		var quatInverse = quat.clone().inverse();

		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update() {

			var position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta to be between desired limits
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

			// restrict phi to be between desired limits
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

			spherical.makeSafe();


			spherical.radius *= scale;

			// restrict radius to be between desired limits
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target to panned location
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping === true ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

				panOffset.multiplyScalar( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );

				panOffset.set( 0, 0, 0 );

			}

			scale = 1;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	this.dispose = function () {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		window.removeEventListener( 'keydown', onKeyDown, false );

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4 };

	var state = STATE.NONE;

	var EPS = 0.000001;

	// current position in spherical coordinates
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();

	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	var panLeft = function () {

		var v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}();

	var panUp = function () {

		var v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			if ( scope.screenSpacePanning === true ) {

				v.setFromMatrixColumn( objectMatrix, 1 );

			} else {

				v.setFromMatrixColumn( objectMatrix, 0 );
				v.crossVectors( scope.object.up, v );

			}

			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		var offset = new THREE.Vector3();

		return function pan( deltaX, deltaY ) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if ( scope.object.isPerspectiveCamera ) {

				// perspective
				var position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we use only clientHeight here so aspect ratio does not distort speed
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object.isOrthographicCamera ) {

				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;

			}

		};

	}();

	function dollyIn( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale /= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	function dollyOut( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate( event ) {

		//console.log( 'handleMouseDownRotate' );

		rotateStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownDolly( event ) {

		//console.log( 'handleMouseDownDolly' );

		dollyStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownPan( event ) {

		//console.log( 'handleMouseDownPan' );

		panStart.set( event.clientX, event.clientY );

	}

	function handleMouseMoveRotate( event ) {

		//console.log( 'handleMouseMoveRotate' );

		rotateEnd.set( event.clientX, event.clientY );

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleMouseMoveDolly( event ) {

		//console.log( 'handleMouseMoveDolly' );

		dollyEnd.set( event.clientX, event.clientY );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyIn( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyOut( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleMouseMovePan( event ) {

		//console.log( 'handleMouseMovePan' );

		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleMouseUp( event ) {

		// console.log( 'handleMouseUp' );

	}

	function handleMouseWheel( event ) {

		// console.log( 'handleMouseWheel' );

		if ( event.deltaY < 0 ) {

			dollyOut( getZoomScale() );

		} else if ( event.deltaY > 0 ) {

			dollyIn( getZoomScale() );

		}

		scope.update();

	}

	function handleKeyDown( event ) {

		// console.log( 'handleKeyDown' );

		var needsUpdate = false;

		switch ( event.keyCode ) {

			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				needsUpdate = true;
				break;

			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				needsUpdate = true;
				break;

			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;

			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;

		}

		if ( needsUpdate ) {

			// prevent the browser from scrolling on cursor keys
			event.preventDefault();

			scope.update();

		}


	}

	function handleTouchStartRotate( event ) {

		//console.log( 'handleTouchStartRotate' );

		rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchStartDollyPan( event ) {

		//console.log( 'handleTouchStartDollyPan' );

		if ( scope.enableZoom ) {

			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

			var distance = Math.sqrt( dx * dx + dy * dy );

			dollyStart.set( 0, distance );

		}

		if ( scope.enablePan ) {

			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panStart.set( x, y );

		}

	}

	function handleTouchMoveRotate( event ) {

		//console.log( 'handleTouchMoveRotate' );

		rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleTouchMoveDollyPan( event ) {

		//console.log( 'handleTouchMoveDollyPan' );

		if ( scope.enableZoom ) {

			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

			var distance = Math.sqrt( dx * dx + dy * dy );

			dollyEnd.set( 0, distance );

			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );

			dollyIn( dollyDelta.y );

			dollyStart.copy( dollyEnd );

		}

		if ( scope.enablePan ) {

			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panEnd.set( x, y );

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

			pan( panDelta.x, panDelta.y );

			panStart.copy( panEnd );

		}

		scope.update();

	}

	function handleTouchEnd( event ) {

		//console.log( 'handleTouchEnd' );

	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onMouseDown( event ) {

		if ( scope.enabled === false ) return;

		// Prevent the browser from scrolling.

		event.preventDefault();

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.

		scope.domElement.focus ? scope.domElement.focus() : window.focus();

		switch ( event.button ) {

			case scope.mouseButtons.LEFT:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( scope.enablePan === false ) return;

					handleMouseDownPan( event );

					state = STATE.PAN;

				} else {

					if ( scope.enableRotate === false ) return;

					handleMouseDownRotate( event );

					state = STATE.ROTATE;

				}

				break;

			case scope.mouseButtons.MIDDLE:

				if ( scope.enableZoom === false ) return;

				handleMouseDownDolly( event );

				state = STATE.DOLLY;

				break;

			case scope.mouseButtons.RIGHT:

				if ( scope.enablePan === false ) return;

				handleMouseDownPan( event );

				state = STATE.PAN;

				break;

		}

		if ( state !== STATE.NONE ) {

			document.addEventListener( 'mousemove', onMouseMove, false );
			document.addEventListener( 'mouseup', onMouseUp, false );

			scope.dispatchEvent( startEvent );

		}

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		switch ( state ) {

			case STATE.ROTATE:

				if ( scope.enableRotate === false ) return;

				handleMouseMoveRotate( event );

				break;

			case STATE.DOLLY:

				if ( scope.enableZoom === false ) return;

				handleMouseMoveDolly( event );

				break;

			case STATE.PAN:

				if ( scope.enablePan === false ) return;

				handleMouseMovePan( event );

				break;

		}

	}

	function onMouseUp( event ) {

		if ( scope.enabled === false ) return;

		handleMouseUp( event );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onMouseWheel( event ) {

		if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

		event.preventDefault();
		event.stopPropagation();

		scope.dispatchEvent( startEvent );

		handleMouseWheel( event );

		scope.dispatchEvent( endEvent );

	}

	function onKeyDown( event ) {

		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

		handleKeyDown( event );

	}

	function onTouchStart( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		switch ( event.touches.length ) {

			case 1:	// one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;

				handleTouchStartRotate( event );

				state = STATE.TOUCH_ROTATE;

				break;

			case 2:	// two-fingered touch: dolly-pan

				if ( scope.enableZoom === false && scope.enablePan === false ) return;

				handleTouchStartDollyPan( event );

				state = STATE.TOUCH_DOLLY_PAN;

				break;

			default:

				state = STATE.NONE;

		}

		if ( state !== STATE.NONE ) {

			scope.dispatchEvent( startEvent );

		}

	}

	function onTouchMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1: // one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;
				if ( state !== STATE.TOUCH_ROTATE ) return; // is this needed?

				handleTouchMoveRotate( event );

				break;

			case 2: // two-fingered touch: dolly-pan

				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				if ( state !== STATE.TOUCH_DOLLY_PAN ) return; // is this needed?

				handleTouchMoveDollyPan( event );

				break;

			default:

				state = STATE.NONE;

		}

	}

	function onTouchEnd( event ) {

		if ( scope.enabled === false ) return;

		handleTouchEnd( event );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onContextMenu( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

	}

	//

	scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

	scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

	scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
	scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
	scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

	window.addEventListener( 'keydown', onKeyDown, false );

	// force an update at start

	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties( THREE.OrbitControls.prototype, {

	center: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .center has been renamed to .target' );
			return this.target;

		}

	},

	// backward compatibility

	noZoom: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			return ! this.enableZoom;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			this.enableZoom = ! value;

		}

	},

	noRotate: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			return ! this.enableRotate;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			this.enableRotate = ! value;

		}

	},

	noPan: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			return ! this.enablePan;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			this.enablePan = ! value;

		}

	},

	noKeys: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			return ! this.enableKeys;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			this.enableKeys = ! value;

		}

	},

	staticMoving: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			return ! this.enableDamping;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			this.enableDamping = ! value;

		}

	},

	dynamicDampingFactor: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			return this.dampingFactor;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			this.dampingFactor = value;

		}

	}

} );



/**
 * @author alteredq / http://alteredqualia.com/
 * @author mr.doob / http://mrdoob.com/
 */

var Detector = {

	canvas: !! window.CanvasRenderingContext2D,
	webgl: ( function () {

		try {

			var canvas = document.createElement( 'canvas' ); return !! ( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );

		} catch ( e ) {

			return false;

		}

	} )(),
	workers: !! window.Worker,
	fileapi: window.File && window.FileReader && window.FileList && window.Blob,

	getWebGLErrorMessage: function () {

		var element = document.createElement( 'div' );
		element.id = 'webgl-error-message';
		element.style.fontFamily = 'monospace';
		element.style.fontSize = '13px';
		element.style.fontWeight = 'normal';
		element.style.textAlign = 'center';
		element.style.background = '#fff';
		element.style.color = '#000';
		element.style.padding = '1.5em';
		element.style.width = '400px';
		element.style.margin = '5em auto 0';

		if ( ! this.webgl ) {

			element.innerHTML = window.WebGLRenderingContext ? [
				'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
				'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
			].join( '\n' ) : [
				'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
				'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
			].join( '\n' );

		}

		return element;

	},

	addGetWebGLMessage: function ( parameters ) {

		var parent, id, element;

		parameters = parameters || {};

		parent = parameters.parent !== undefined ? parameters.parent : document.body;
		id = parameters.id !== undefined ? parameters.id : 'oldie';

		element = Detector.getWebGLErrorMessage();
		element.id = id;

		parent.appendChild( element );

	}

};

// browserify support
if ( typeof module === 'object' ) {

	module.exports = Detector;

}



// stats.js - http://github.com/mrdoob/stats.js
var Stats=function(){function h(a){c.appendChild(a.dom);return a}function k(a){for(var d=0;d<c.children.length;d++)c.children[d].style.display=d===a?"block":"none";l=a}var l=0,c=document.createElement("div");c.style.cssText="position:fixed;top:60px;left:0;cursor:pointer;opacity:0.9;z-index:10000";c.addEventListener("click",function(a){a.preventDefault();k(++l%c.children.length)},!1);var g=(performance||Date).now(),e=g,a=0,r=h(new Stats.Panel("FPS","#0ff","#002")),f=h(new Stats.Panel("MS","#0f0","#020"));
if(self.performance&&self.performance.memory)var t=h(new Stats.Panel("MB","#f08","#201"));k(0);return{REVISION:16,dom:c,addPanel:h,showPanel:k,begin:function(){g=(performance||Date).now()},end:function(){a++;var c=(performance||Date).now();f.update(c-g,200);if(c>e+1E3&&(r.update(1E3*a/(c-e),100),e=c,a=0,t)){var d=performance.memory;t.update(d.usedJSHeapSize/1048576,d.jsHeapSizeLimit/1048576)}return c},update:function(){g=this.end()},domElement:c,setMode:k}};
Stats.Panel=function(h,k,l){var c=Infinity,g=0,e=Math.round,a=e(window.devicePixelRatio||1),r=220*a,f=48*a,t=3*a,u=2*a,d=3*a,m=15*a,n=214*a,p=30*a,q=document.createElement("canvas");q.width=r;q.height=f;q.style.cssText="width:220px;height:48px";var b=q.getContext("2d");b.font="bold "+9*a+"px Helvetica,Arial,sans-serif";b.textBaseline="top";b.fillStyle=l;b.fillRect(0,0,r,f);b.fillStyle=k;b.fillText(h,t,u);b.fillRect(d,m,n,p);b.fillStyle=l;b.globalAlpha=.9;b.fillRect(d,m,n,p);return{dom:q,update:function(f,
v){c=Math.min(c,f);g=Math.max(g,f);b.fillStyle=l;b.globalAlpha=1;b.fillRect(0,0,r,m);b.fillStyle=k;b.fillText(e(f)+" "+h+" ("+e(c)+"-"+e(g)+")",t,u);b.drawImage(q,d+a,m,n-a,p,d,m,n-a,p);b.fillRect(d+n-a,m,a,p);b.fillStyle=l;b.globalAlpha=.9;b.fillRect(d+n-a,m,a,e((1-f/v)*p))}}};"object"===typeof module&&(module.exports=Stats);








/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.SceneLoader = function (manager) {

	this.onLoadStart = function () {};
	this.onLoadProgress = function () {};
	this.onLoadComplete = function () {};

	this.callbackSync = function () {};
	this.callbackProgress = function () {};

	this.geometryHandlers = {};
	this.hierarchyHandlers = {};

	// this.addGeometryHandler("ascii", THREE.JSONLoader);

	this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;

	this.byRequest = false;

};

THREE.SceneLoader.prototype = {

	constructor: THREE.SceneLoader,

	load: function (url, onLoad, onProgress, onError) {

		var scope = this;

		var loader = new THREE.FileLoader(scope.manager);

		loader.load(url, function (text) {

			scope.parse(JSON.parse(text), onLoad, url);

		}, onProgress, onError);

	},

	addGeometryHandler: function (typeID, loaderClass) {

		this.geometryHandlers[typeID] = {
			"loaderClass": loaderClass
		};

	},

	addHierarchyHandler: function (typeID, loaderClass) {

		this.hierarchyHandlers[typeID] = {
			"loaderClass": loaderClass
		};

	},

	parse: function (json, callbackFinished, url) {

		var scope = this;

		var urlBase = THREE.LoaderUtils.extractUrlBase(url);
		this.urlBase = urlBase;

		var geometry,
		material,
		camera,
		fog,
		texture,
		images,
		color,
		light,
		hex,
		intensity,
		counter_models,
		counter_textures,
		total_models,
		total_textures,
		result;

		var target_array = [];
		var materialsInMeshs = [];
		var texturesInMaterials = [];

		this.materialsInMeshs = materialsInMeshs;
		this.texturesInMaterials = texturesInMaterials;

		var data = json;
		this.data = data;

		// async geometry loaders

		for (var typeID in this.geometryHandlers) {

			var loaderClass = this.geometryHandlers[typeID]["loaderClass"];
			this.geometryHandlers[typeID]["loaderObject"] = new loaderClass();

		}

		// async hierachy loaders

		for (var typeID in this.hierarchyHandlers) {

			var loaderClass = this.hierarchyHandlers[typeID]["loaderClass"];
			this.hierarchyHandlers[typeID]["loaderObject"] = new loaderClass();

		}

		counter_models = 0;
		counter_textures = 0;

		result = {

			scene: new THREE.Scene(),
			geometries: {},
			face_materials: {},
			materials: {},
			textures: {},
			objects: {},
			cameras: {},
			lights: {},
			fogs: {},
			empties: {},
			groups: {}

		};

		this.result = result;

		if (data.transform) {

			var position = data.transform.position || [0, 0, 0],
			rotation = data.transform.rotation || [0, 0, 0],
			scale = data.transform.scale || [1, 1, 1];

			if (position) {

				result.scene.position.fromArray(position);

			}

			if (rotation) {

				result.scene.rotation.fromArray(rotation);

			}

			if (scale) {

				result.scene.scale.fromArray(scale);

			}

			if (position || rotation || scale) {

				result.scene.updateMatrix();
				result.scene.updateMatrixWorld();

			}

		}

		// toplevel loader function, delegates to handle_children

		function handle_objects() {

			handle_children(result.scene, data.objects);

		}

		// handle all the children from the loaded json and attach them to given parent

		function handle_children(parent, children) {

			var mat,
			dst,
			pos,
			rot,
			scl,
			quat;

			for (var objID in children) {

				// check by id if child has already been handled,
				// if not, create new object

				var object = result.objects[objID];
				var objJSON = children[objID];

				if (object === undefined) {

					// meshes

					if (objJSON.type && (objJSON.type in scope.hierarchyHandlers)) {

						if (objJSON.loading === undefined) {

							material = result.materials[objJSON.material];

							objJSON.loading = true;

							var loader = scope.hierarchyHandlers[objJSON.type]["loaderObject"];

							// ColladaLoader

							if (loader.options) {

								loader.load(scope.get_url(objJSON.url, data.urlBaseType), create_callback_hierachy(objID, parent, material, objJSON));

								// UTF8Loader
								// OBJLoader

							} else {

								loader.load(scope.get_url(objJSON.url, data.urlBaseType), create_callback_hierachy(objID, parent, material, objJSON));

							}

						}

					} else if (objJSON.geometry !== undefined) {

						geometry = result.geometries[objJSON.geometry];

						// geometry already loaded

						if (geometry) {

							material = result.materials[objJSON.material];

							pos = objJSON.position || [0, 0, 0];
							rot = objJSON.rotation || [0, 0, 0];
							scl = objJSON.scale || [1, 1, 1];
							mat = objJSON.matrix;
							quat = objJSON.quaternion;

							// use materials from the model file
							// if there is no material specified in the object

							if (!objJSON.material) {

								material = new THREE.MultiMaterial(result.face_materials[objJSON.geometry]);

							}

							// use materials from the model file
							// if there is just empty face material
							// (must create new material as each model has its own face material)

							if ((material instanceof THREE.MultiMaterial) && material.materials.length === 0) {

								material = new THREE.MultiMaterial(result.face_materials[objJSON.geometry]);

							}

							if (objJSON.skin) {

								object = new THREE.SkinnedMesh(geometry, material);

							} else if (objJSON.morph) {

								object = new THREE.MorphAnimMesh(geometry, material);

								if (objJSON.duration !== undefined) {

									object.duration = objJSON.duration;

								}

								if (objJSON.time !== undefined) {

									object.time = objJSON.time;

								}

								if (objJSON.mirroredLoop !== undefined) {

									object.mirroredLoop = objJSON.mirroredLoop;

								}

								if (material.morphNormals) {

									geometry.computeMorphNormals();

								}

							} else {

								object = new THREE.Mesh(geometry, material);

							}

							object.name = objID;

							if (mat) {

								object.matrixAutoUpdate = false;
								object.matrix.set(
									mat[0], mat[1], mat[2], mat[3],
									mat[4], mat[5], mat[6], mat[7],
									mat[8], mat[9], mat[10], mat[11],
									mat[12], mat[13], mat[14], mat[15]);

							} else {

								object.position.fromArray(pos);

								if (quat) {

									object.quaternion.fromArray(quat);

								} else {

									object.rotation.fromArray(rot);

								}

								object.scale.fromArray(scl);

							}

							object.visible = objJSON.visible;
							object.castShadow = objJSON.castShadow;
							object.receiveShadow = objJSON.receiveShadow;

							parent.add(object);

							result.objects[objID] = object;

						}

						// lights

					} else if (objJSON.type === "AmbientLight" || objJSON.type === "PointLight" ||
						objJSON.type === "DirectionalLight" || objJSON.type === "SpotLight" ||
						objJSON.type === "HemisphereLight") {

						var color = objJSON.color;
						var intensity = objJSON.intensity;
						var distance = objJSON.distance;
						var position = objJSON.position;
						var rotation = objJSON.rotation;

						switch (objJSON.type) {

						case 'AmbientLight':
							light = new THREE.AmbientLight(color, intensity);
							break;

						case 'PointLight':
							light = new THREE.PointLight(color, intensity, distance);
							light.position.fromArray(position);
							break;

						case 'DirectionalLight':
							light = new THREE.DirectionalLight(color, intensity);
							light.position.fromArray(objJSON.direction);
							break;

						case 'SpotLight':
							light = new THREE.SpotLight(color, intensity, distance);
							light.angle = objJSON.angle;
							light.position.fromArray(position);
							light.target.set(position[0], position[1] - distance, position[2]);
							light.target.applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
							break;

						case 'HemisphereLight':
							light = new THREE.DirectionalLight(color, intensity, distance);
							light.target.set(position[0], position[1] - distance, position[2]);
							light.target.applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
							break;

						}

						parent.add(light);

						light.name = objID;
						result.lights[objID] = light;
						result.objects[objID] = light;

						// cameras

					} else if (objJSON.type === "CombinedCamera" || objJSON.type === "PerspectiveCamera" || objJSON.type === "OrthographicCamera") {

						pos = objJSON.position || [0, 0, 0];
						rot = objJSON.rotation || [0, 0, 0];
						quat = objJSON.quaternion;

						if (objJSON.type === "PerspectiveCamera") {

							camera = new THREE.PerspectiveCamera(objJSON.fov, objJSON.aspect, objJSON.near, objJSON.far);

						} else if (objJSON.type === "OrthographicCamera") {

							camera = new THREE.OrthographicCamera(objJSON.left, objJSON.right, objJSON.top, objJSON.bottom, objJSON.near, objJSON.far);

						}else if (objJSON.type === "CombinedCamera") {

							camera = new THREE.CombinedCamera(objJSON.left, objJSON.right, objJSON.top, objJSON.bottom, objJSON.near, objJSON.far);

						}

						camera.name = objID;
						camera.section_view = objJSON.section_view;
						camera.autoZoom = objJSON.autoZoom;
						camera.position.fromArray(pos);

						if (quat !== undefined) {

							camera.quaternion.fromArray(quat);

						} else if (rot !== undefined) {

							camera.rotation.fromArray(rot);

						}
						if (objJSON.target) {

							camera.lookAt(new THREE.Vector3().fromArray(objJSON.target));
							camera.target = new THREE.Vector3().fromArray(objJSON.target);
						}

						if (objJSON.section_view) {

							camera.section_view = objJSON.section_view;
						}

						if (objJSON.autoZoom) {

							camera.autoZoom = objJSON.autoZoom;
						}

						parent.add(camera);

						result.cameras[objID] = camera;
						result.objects[objID] = camera;

						if (objJSON.userData !== undefined) {

							for (var key in objJSON.userData) {

								var value = objJSON.userData[key];
								camera.userData[key] = value;

							}

						}

						// pure Object3D

					} else {

						pos = objJSON.position;
						rot = objJSON.rotation;
						scl = objJSON.scale;
						quat = objJSON.quaternion;

						object = new THREE.Object3D();
						object.name = objID;
						object.position.fromArray(pos);

						if (quat) {

							object.quaternion.fromArray(quat);

						} else {

							object.rotation.fromArray(rot);

						}

						object.scale.fromArray(scl);
						object.visible = (objJSON.visible !== undefined) ? objJSON.visible : false;

						parent.add(object);

						result.objects[objID] = object;
						result.empties[objID] = object;

					}

					if (object) {

						if (objJSON.userData !== undefined) {

							for (var key in objJSON.userData) {

								var value = objJSON.userData[key];
								object.userData[key] = value;

							}

						}

						if (objJSON.groups !== undefined) {

							for (var i = 0; i < objJSON.groups.length; i++) {

								var groupID = objJSON.groups[i];

								if (result.groups[groupID] === undefined) {

									result.groups[groupID] = [];

								}

								result.groups[groupID].push(objID);

							}

						}

					}

				}

				if (object !== undefined && objJSON.children !== undefined) {

					handle_children(object, objJSON.children);

				}

			}

		}

		function checkMaterials(children) {

			for (var objID in children) {

				var objJSON = children[objID];

				if (objJSON.material) {

					if (data.materials[objJSON.material].type === 'MeshFaceMaterial') {

						for (var i = 0, j = data.materials[objJSON.material].parameters.materials.length; i < j; i++) {
							if (materialsInMeshs.indexOf(data.materials[objJSON.material].parameters.materials[i]) == -1) {
								materialsInMeshs.push(data.materials[objJSON.material].parameters.materials[i]);
								texturesNameToArray(data.materials[data.materials[objJSON.material].parameters.materials[i]]);
							}
						}

					}

					if (data.materials[objJSON.material].type === 'MultiMaterial') {

						for (var i = 0, j = data.materials[objJSON.material].parameters.materials.length; i < j; i++) {
							if (materialsInMeshs.indexOf(data.materials[objJSON.material].parameters.materials[i]) == -1) {
								materialsInMeshs.push(data.materials[objJSON.material].parameters.materials[i]);
								texturesNameToArray(data.materials[data.materials[objJSON.material].parameters.materials[i]]);
							}
						}

					}

					if (materialsInMeshs.indexOf(objJSON.material) == -1) {
						materialsInMeshs.push(objJSON.material);
						texturesNameToArray(data.materials[objJSON.material])
					}

				}

				if (objJSON.children !== undefined) {

					checkMaterials(objJSON.children);

				}

			}

		}

		function texturesNameToArray(material) {

			for (parID in material.parameters) {

				if (parID === "envMap" || parID === "map" || parID === "lightMap" || parID === "bumpMap" || parID === "normalMap" || parID === "specularMap" || parID === "emissiveMap" || parID === "alphaMap" || parID === "roughnessMap" || parID === "metalnessMap" || parID === "aoMap") {
					var texture = material.parameters[parID];
					if (texture != undefined && texturesInMaterials.indexOf(texture) == -1)
						texturesInMaterials.push(texture);
				}
			}
		}

		function handle_mesh(geo, mat, id) {

			result.geometries[id] = geo;
			result.face_materials[id] = mat;
			handle_objects();

		}

		function handle_hierarchy(node, id, parent, material, obj) {

			var p = obj.position;
			var r = obj.rotation;
			var q = obj.quaternion;
			var s = obj.scale;

			node.position.fromArray(p);

			if (q) {

				node.quaternion.fromArray(q);

			} else {

				node.rotation.fromArray(r);

			}

			node.scale.fromArray(s);

			// override children materials
			// if object material was specified in JSON explicitly

			if (material) {

				node.traverse(function (child) {

					child.material = material;

				});

			}

			// override children visibility
			// with root node visibility as specified in JSON

			var visible = (obj.visible !== undefined) ? obj.visible : true;

			node.traverse(function (child) {

				child.visible = visible;

			});

			parent.add(node);

			node.name = id;

result.objects[id] = node;
			handle_objects();

		}

		function create_callback_geometry(id) {

			return function (geo, mat) {

				geo.name = id;

				handle_mesh(geo, mat, id);

				counter_models -= 1;

				scope.onLoadComplete();

				async_callback_gate();

			}

		}

		function create_callback_hierachy(id, parent, material, obj) {

			return function (event) {

				var result;

				// loaders which use EventDispatcher

				if (event.content) {

					result = event.content;

					// ColladaLoader

				} else if (event.dae) {

					result = event.scene;

					// UTF8Loader

				} else {

					result = event;

				}

				handle_hierarchy(result, id, parent, material, obj);

				counter_models -= 1;

				scope.onLoadComplete();

				async_callback_gate();

			}

		}

		function create_callback_embed(id) {

			return function (geo, mat) {

				geo.name = id;

				result.geometries[id] = geo;
				result.face_materials[id] = mat;

			}

		}

		function async_callback_gate(onLoad) {

			var progress = {

				totalModels: total_models,
				totalTextures: total_textures,
				loadedModels: total_models - counter_models,
				loadedTextures: total_textures - counter_textures

			};

			scope.callbackProgress(progress, result);

			scope.onLoadProgress();

			if (counter_models === 0 && counter_textures === 0) {

				finalize();
				callbackFinished(result);

				if (onLoad) {
					onLoad(result);
				}

			}

		}

		function finalize() {

			// take care of targets which could be asynchronously loaded objects

			for (var i = 0; i < target_array.length; i++) {

				var ta = target_array[i];

				var target = result.objects[ta.targetName];

				if (target) {

					ta.object.target = target;

				} else {

					// if there was error and target of specified name doesn't exist in the scene file
					// create instead dummy target
					// (target must be added to scene explicitly as parent is already added)

					ta.object.target = new THREE.Object3D();
					result.scene.add(ta.object.target);

				}

				ta.object.target.userData.targetInverse = ta.object;

			}

		}

		var callbackTexture = function (count, onLoad) {

			counter_textures -= count;
			async_callback_gate(onLoad);

			scope.onLoadComplete();

		};

		// must use this instead of just directly calling callbackTexture
		// because of closure in the calling context loop

		var generateTextureCallback = function (count, onLoad) {

			return function () {

				callbackTexture(count, onLoad);

			};

		};

		function traverse_json_hierarchy(objJSON, callback) {

			callback(objJSON);

			if (objJSON.children !== undefined) {

				for (var objChildID in objJSON.children) {

					traverse_json_hierarchy(objJSON.children[objChildID], callback);

				}

			}

		}

		// first go synchronous elements

		// fogs

		var fogID,
		fogJSON;

		for (fogID in data.fogs) {

			fogJSON = data.fogs[fogID];

			if (fogJSON.type === "linear") {

				fog = new THREE.Fog(0x000000, fogJSON.near, fogJSON.far);

			} else if (fogJSON.type === "exp2") {

				fog = new THREE.FogExp2(0x000000, fogJSON.density);

			}

			color = fogJSON.color;
			fog.color.setRGB(color[0], color[1], color[2]);

			result.fogs[fogID] = fog;

		}

		// now come potentially asynchronous elements

		// geometries

		// count how many geometries will be loaded asynchronously

		var geoID,
		geoJSON;

		for (geoID in data.geometries) {

			geoJSON = data.geometries[geoID];

			if (geoJSON.type in this.geometryHandlers) {

				counter_models += 1;

				scope.onLoadStart();

			}

		}

		// count how many hierarchies will be loaded asynchronously

		for (var objID in data.objects) {

			traverse_json_hierarchy(data.objects[objID], function (objJSON) {

				if (objJSON.type && (objJSON.type in scope.hierarchyHandlers)) {

					counter_models += 1;

					scope.onLoadStart();

				}

			});

		}

		total_models = counter_models;

		for (geoID in data.geometries) {

			geoJSON = data.geometries[geoID];

			if (geoJSON.type === "cube") {

				geometry = new THREE.BoxBufferGeometry(geoJSON.width, geoJSON.height, geoJSON.depth, geoJSON.widthSegments, geoJSON.heightSegments, geoJSON.depthSegments);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type === "plane") {

				geometry = new THREE.PlaneBufferGeometry(geoJSON.width, geoJSON.height, geoJSON.widthSegments, geoJSON.heightSegments);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type === "sphere") {

				geometry = new THREE.SphereBufferGeometry(geoJSON.radius, geoJSON.widthSegments, geoJSON.heightSegments);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type === "cylinder") {

				geometry = new THREE.CylinderBufferGeometry(geoJSON.topRad, geoJSON.botRad, geoJSON.height, geoJSON.radSegs, geoJSON.heightSegs);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type === "torus") {

				geometry = new THREE.TorusBufferGeometry(geoJSON.radius, geoJSON.tube, geoJSON.segmentsR, geoJSON.segmentsT);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type === "icosahedron") {

				geometry = new THREE.IcosahedronGeometry(geoJSON.radius, geoJSON.subdivisions);
				geometry.name = geoID;
				result.geometries[geoID] = geometry;

			} else if (geoJSON.type in this.geometryHandlers) {

				var loader = this.geometryHandlers[geoJSON.type]["loaderObject"];
				loader.load(scope.get_url(geoJSON.url, data.urlBaseType), create_callback_geometry(geoID));

			} else if (geoJSON.type === "embedded") {

				var modelJson = data.embeds[geoJSON.id],
				texture_path = "";

				// pass metadata along to jsonLoader so it knows the format version

				modelJson.metadata = data.metadata;

				if (modelJson) {

					var jsonLoader = this.geometryHandlers["ascii"]["loaderObject"];
					var model = jsonLoader.parse(modelJson, texture_path);
					create_callback_embed(geoID)(model.geometry, model.materials);

				}

			}

		}

		// textures

		if (this.byRequest)
			checkMaterials(data.objects);

		// count how many textures will be loaded asynchronously

		var textID,
		textureJSON;

		for (textID in data.textures) {

			if (this.byRequest && texturesInMaterials.indexOf(textID) == -1)
				continue;

			countTexture(textID);

		}

		total_textures = counter_textures;

		for (textID in data.textures) {

			if (this.byRequest && texturesInMaterials.indexOf(textID) == -1)
				continue;

			scope.addTexture(textID, undefined, generateTextureCallback);

		}

		function countTexture(textureID) {

			if (result.textures[textureID])
				return;

			textureJSON = data.textures[textureID];
			if (Array.isArray(textureJSON.url)) {

				counter_textures += textureJSON.url.length;

				for (var n = 0; n < textureJSON.url.length; n++) {

					scope.onLoadStart();

				}

			} else {

				counter_textures += 1;

				scope.onLoadStart();

			}

		}

		// materials


		var matID,
		matJSON;
		var parID;

		for (matID in data.materials) {

			if (this.byRequest && materialsInMeshs.indexOf(matID) == -1)
				continue;

			scope.addMaterial(matID);

		}

		// second pass through all materials to initialize MultiMaterials
		// that could be referring to other materials out of order

		for (matID in data.materials) {

			if (this.byRequest && materialsInMeshs.indexOf(matID) == -1)
				continue;

			scope.addFaceMaterial(matID);

		}

		// objects ( synchronous init of procedural primitives )

		handle_objects();

		// defaults

		if (result.cameras && data.defaults.camera) {

			result.currentCamera = result.cameras[data.defaults.camera];

		}

		if (result.fogs && data.defaults.fog) {

			result.scene.fog = result.fogs[data.defaults.fog];

		}

		// synchronous callback

		scope.callbackSync(result);

		// just in case there are no async elements

		async_callback_gate();

	},

	newMaterial: function (key, onLoad) {

		var counter_textures = 0;
		var total_textures = 0;
		var scope = this;

		var callbackTexture = function (count, onLoad) {

			counter_textures -= count;
			async_callback_gate(onLoad);

		};

		var generateTextureCallback = function (count, onLoad) {

			return function () {

				callbackTexture(count, onLoad);

			};

		};

		if (!this.result.materials[key]) {

			var mat = this.data.materials[key];
			if (mat.parameters.materials) {
				console.log('mat',mat.parameters.materials);

				for (var i = 0, j = mat.parameters.materials.length; i < j; i++) {
					applyTexture(this.data.materials[mat.parameters.materials[i]], onLoad);

					scope.addMaterial(mat.parameters.materials[i]);
					console.log('addMaterial',mat.parameters.materials[i]);
					console.log('addMaterial_applyTexture',this.data.materials);
					//console.log('addMateria_J',j);
				}

				console.log('result_material');
				scope.addMaterial(key);
				scope.addFaceMaterial(key);
				//onLoad();
				//console.log('scope_material',scope.addMaterial(key));
			} else {
				//console.log('result_material_else');
				applyTexture(mat, onLoad);
				scope.addMaterial(key);
			}
		} else {
			onLoad();
			//console.log('result_material_else_else');
		}

		function applyTexture(material, onLoad) {


			console.log('applyTexture');
			var array = getTexturesName(material);

			if (array.length == 0)

				return;

			total_textures += array.length;

			for (var i = 0; i < array.length; i++) {

				countTexture(array[i]);

			}

			for (var i = 0; i < array.length; i++) {

				scope.addTexture(array[i], onLoad, generateTextureCallback);

			}


			console.log('total_textures',array);

		}

		function getTexturesName(material) {

			var array = [];
			for (var parID in material.parameters) {

				if (parID === "envMap" || parID === "map" || parID === "lightMap" || parID === "bumpMap" || parID === "normalMap" || parID === "specularMap" || parID === "emissiveMap" || parID === "alphaMap" || parID === "roughnessMap" || parID === "metalnessMap" || parID === "aoMap") {
					var texture = material.parameters[parID];
					if (texture != undefined && scope.texturesInMaterials.indexOf(texture) == -1
						 && array.indexOf(texture) == -1 && !(texture instanceof THREE.Texture))
						array.push(texture);
				}
			}
			return array;
		}

		function countTexture(textureID) {

			if (scope.result.textures[textureID])
				return;

			var textureJSON = scope.data.textures[textureID];
			if (Array.isArray(textureJSON.url)) {

				counter_textures += textureJSON.url.length;

				for (var n = 0; n < textureJSON.url.length; n++) {

					scope.onLoadStart();

				}

			} else {

				counter_textures += 1;

				scope.onLoadStart();

			}
		}

		function async_callback_gate(onLoad) {

			var progress = {

				totalTextures: total_textures,
				loadedTextures: total_textures - counter_textures,

			};

			console.log('total_textures',total_textures),
			console.log('counter_textures',counter_textures),

			scope.callbackProgress(progress, scope.result);

			if (counter_textures === 0) {


			console.log('counter_textures_0');

				if (onLoad) {
				console.log('onLoad_onLoad');
					onLoad();
				}

			}

		}

	},

	addMaterial: function (matID) {
		var scope = this;

		if (scope.result.materials[matID])
			return;

		var matJSON = scope.data.materials[matID];

		for (var parID in matJSON.parameters) {

			if (parID === "envMap" || parID === "map" || parID === "lightMap" || parID === "bumpMap" || parID === "normalMap" || parID === "specularMap" || parID === "emissiveMap" || parID === "alphaMap" || parID === "roughnessMap" || parID === "metalnessMap" || parID === "aoMap") {

				matJSON.parameters[parID] = scope.result.textures[matJSON.parameters[parID]];

			} else if ( parID === "flatShading" ) {

				if ( matJSON.parameters[ parID ] = "true" ) {

                matJSON.parameters[ parID ] = THREE.FlatShading;

				}

			} else if (parID === "side") {

				if (matJSON.parameters[parID] == "double") {

					matJSON.parameters[parID] = THREE.DoubleSide;

				} else if (matJSON.parameters[parID] == "back") {

					matJSON.parameters[parID] = THREE.BackSide;

				} else {

					matJSON.parameters[parID] = THREE.FrontSide;

				}

			} else if (parID === "blending") {

				matJSON.parameters[parID] = matJSON.parameters[parID]in THREE ? THREE[matJSON.parameters[parID]] : THREE.NormalBlending;

			} else if (parID === "depthMode") {

				matJSON.parameters[parID] = matJSON.parameters[parID]in THREE ? THREE[matJSON.parameters[parID]] : THREE.NeverDepth;

			} else if (parID === "combine") {

				matJSON.parameters[parID] = matJSON.parameters[parID]in THREE ? THREE[matJSON.parameters[parID]] : THREE.MultiplyOperation;

			} else if (parID === "vertexColors") {

				if (matJSON.parameters[parID] == "face") {

					matJSON.parameters[parID] = THREE.FaceColors;

					// default to vertex colors if "vertexColors" is anything else face colors or 0 / null / false

				} else if (matJSON.parameters[parID]) {

					matJSON.parameters[parID] = THREE.VertexColors;

				}

			} else if (parID === "wrapRGB") {

				var v3 = matJSON.parameters[parID];
				matJSON.parameters[parID] = new THREE.Vector3(v3[0], v3[1], v3[2]);

			} else if (parID === "normalScale") {

				var v2 = matJSON.parameters[parID];
				matJSON.parameters[parID] = new THREE.Vector2(v2[0], v2[1]);

			}

		}

		if (matJSON.parameters.opacity !== undefined && matJSON.parameters.opacity < 1.0) {

			matJSON.parameters.transparent = true;

		}

		// temporary global override
		matJSON.parameters.side = THREE.DoubleSide;

		//var loader = new MaterialLoader();

		//var geometry = new THREE.BoxBufferGeometry( 1, 1, 1 );
		/*
		var materials = [
		new THREE.MeshDepthMaterial(),
		new THREE.MeshNormalMaterial(),
		new THREE.MeshBasicMaterial( { wireframe: true } ),
		new THREE.MeshLambertMaterial( { color: 0xff0000 } ),
		new THREE.MeshPhongMaterial( { color: 0x0000ff } ),
		new THREE.MeshStandardMaterial( { color: 0x00ff00 } ),
		];
		 */
		/*
		var mesh = new THREE.Mesh( geometry, materials );
		mesh.toJSON();
		 */
		//var material;

		if (matJSON.type == "MultiMaterial") {
			//material = new THREE[ matJSON.type ]( matJSON.parameters.materials );
			//console.log(material.materials[0][0]);
			//console.log(material);
			//scope.result.materials[ matID ] = materials;
			if (matJSON.parameters.materials) {
				var materialArray = [];

				for (var i = 0; i < matJSON.parameters.materials.length; i++) {
					var label = matJSON.parameters.materials[i];
					materialArray.push(scope.result.materials[label]);
				}
				scope.result.materials[matID] = materialArray;
			}
		} else {
			var material = new THREE[matJSON.type](matJSON.parameters);
			material.name = matID;
			scope.result.materials[matID] = material;
		}
		//material.name = matID;
		//material = new THREE[ matJSON.type ]( matJSON.parameters );
		//scope.result.materials[ matID ] = material;

	},

	addFaceMaterial: function (matID) {

		var scope = this;
		var matJSON = scope.data.materials[matID];

		if (matJSON.parameters.materials) {

			var materialArray = [];

			for (var i = 0; i < matJSON.parameters.materials.length; i++) {

				var label = matJSON.parameters.materials[i];
				materialArray.push(scope.result.materials[label]);

			}

			scope.result.materials[matID].materials = materialArray;

		}

	},

	addTexture: function (textureID, onLoad, generateTextureCallback) {

		var scope = this;

		if (scope.result.textures[textureID])
			return;

		var textureJSON = scope.data.textures[textureID];

		if (textureJSON.mapping !== undefined && THREE[textureJSON.mapping] !== undefined) {

			textureJSON.mapping = THREE[textureJSON.mapping];

		}

		var texture;

		if (Array.isArray(textureJSON.url)) {

			var count = textureJSON.url.length;
			var urls = [];

			for (var i = 0; i < count; i++) {

				urls[i] = scope.get_url(textureJSON.url[i], scope.data.urlBaseType);

			}

			var loader = THREE.Loader.Handlers.get(urls[0]);
			// var loader = THREE.LoadingManager.getHandler(urls[0]);

			if (loader !== null) {

				texture = loader.load(urls, generateTextureCallback(count, onLoad));

				if (textureJSON.mapping !== undefined)
					texture.mapping = textureJSON.mapping;

			} else {

				texture = new THREE.CubeTextureLoader().load(urls, generateTextureCallback(count, onLoad));
				texture.mapping = textureJSON.mapping;

			}

		} else {

			var fullUrl = scope.get_url(textureJSON.url, scope.data.urlBaseType);

			var textureCallback = generateTextureCallback(1, onLoad);

			var loader = THREE.Loader.Handlers.get(fullUrl);
			// var loader = THREE.LoadingManager.getHandler(fullUrl);

			if (loader !== null) {

				texture = loader.load(fullUrl, textureCallback);

			} else {

				texture = new THREE.Texture();
				loader = new THREE.ImageLoader();

				(function (texture) {

					loader.load(fullUrl, function (image) {

						texture.image = image;
						texture.needsUpdate = true;

						textureCallback();

					});

				})(texture)

			}

			if (textureJSON.mapping !== undefined)
				texture.mapping = textureJSON.mapping;

			if (THREE[textureJSON.minFilter] !== undefined)
			texture.minFilter = THREE[textureJSON.minFilter];

			if (THREE[textureJSON.magFilter] !== undefined)
				texture.magFilter = THREE[textureJSON.magFilter];

			if (THREE[textureJSON.encoding] !== undefined)
				texture.encoding = THREE[textureJSON.encoding];

			// Values of encoding !== THREE.LinearEncoding only supported on map, envMap and emissiveMap.
			//
			// Also changing the encoding after already used by a Material will not automatically make the Material
			// update.  You need to explicitly call Material.needsUpdate to trigger it to recompile.

			if (THREE[textureJSON.format] !== undefined)
				texture.format = THREE[textureJSON.format];

			if (textureJSON.anisotropy)
				texture.anisotropy = textureJSON.anisotropy;

			if (textureJSON.rotation)
				texture.rotation = textureJSON.rotation;

			if (textureJSON.flipY !== undefined)
				texture.flipY = textureJSON.flipY;

			if (textureJSON.center) {

				texture.center.set(textureJSON.center[0], textureJSON.center[1]);
			}

			if (textureJSON.repeat) {

					texture.repeat.set(textureJSON.repeat[0], textureJSON.repeat[1]);

					if (textureJSON.repeat[0] !== 1)
						texture.wrapS = THREE.RepeatWrapping;
					if (textureJSON.repeat[1] !== 1)
						texture.wrapT = THREE.RepeatWrapping;

				}

				if (textureJSON.offset) {

					texture.offset.set(textureJSON.offset[0], textureJSON.offset[1]);

				}

				// handle wrap after repeat so that default repeat can be overriden
				// MirroredRepeatWrapping, ClampToEdgeWrapping, RepeatWrapping

				if (textureJSON.wrap) {

					var wrapMap = {
						"repeat": THREE.RepeatWrapping,
						"mirror": THREE.MirroredRepeatWrapping,
						"clamp": THREE.ClampToEdgeWrapping
					};

					if (wrapMap[textureJSON.wrap[0]] !== undefined)
						texture.wrapS = wrapMap[textureJSON.wrap[0]];
					if (wrapMap[textureJSON.wrap[1]] !== undefined)
						texture.wrapT = wrapMap[textureJSON.wrap[1]];

				}

			}

			scope.result.textures[textureID] = texture;

		},

		get_url: function (source_url, url_type) {

			var scope = this;

			if (url_type == "relativeToHTML") {

				return source_url;

			} else {

				return scope.urlBase + source_url;

			}

		}

	};









































var ION = ION || {};

// browserify support
if ( typeof module === 'object' ) {

	module.exports = ION;

}

ION.CompressionMethod = {
  RAW: 0x00574152,
  MG1: 0x0031474d,
  MG2: 0x0032474d
};

ION.Flags = {
  NORMALS: 0x00000001
};

ION.File = function(stream) {
//console.profile("3D Test");
	this.load(stream);
//console.profileEnd();
};

ION.File.prototype.load = function(stream) {
	this.header = new ION.FileHeader(stream);

	this.body = new ION.FileBody(this.header);

	this.getReader().read(stream, this.body);
};

ION.File.prototype.getReader = function() {
	var reader;

	switch (this.header.compressionMethod){
		case ION.CompressionMethod.RAW:
			reader = new ION.ReaderRAW();
			break;
		case ION.CompressionMethod.MG1:
			reader = new ION.ReaderMG1();
			break;
		case ION.CompressionMethod.MG2:
			reader = new ION.ReaderMG2();
			break;
	}

	return reader;
};

ION.FileHeader = function(stream) {
	stream.readInt32(); //magic "OCTM"
	this.fileFormat = stream.readInt32();
	this.compressionMethod = stream.readInt32();
	this.vertexCount = stream.readInt32();
	this.triangleCount = stream.readInt32();
	this.uvMapCount = stream.readInt32();
	this.attrMapCount = stream.readInt32();
	this.flags = stream.readInt32();
	this.comment = stream.readString();
};

ION.FileHeader.prototype.hasNormals = function() {
	return this.flags & ION.Flags.NORMALS;
};

ION.FileBody = function(header) {
	var i = header.triangleCount * 3,
      v = header.vertexCount * 3,
      n = header.hasNormals() ? header.vertexCount * 3 : 0,
      u = header.vertexCount * 2,
      a = header.vertexCount * 4,
      j = 0;

	var data = new ArrayBuffer(
    (i + v + n + (u * header.uvMapCount) + (a * header.attrMapCount) ) * 4);

	this.indices = new Uint32Array(data, 0, i);

	this.vertices = new Float32Array(data, i * 4, v);

	if ( header.hasNormals() ) {
		this.normals = new Float32Array(data, (i + v) * 4, n);
	}

	if (header.uvMapCount) {
		this.uvMaps = [];
		for (j = 0; j < header.uvMapCount; ++ j) {
			this.uvMaps[j] = { uv: new Float32Array(data,
        (i + v + n + (j * u) ) * 4, u) };
		}
	}

	if (header.attrMapCount) {
		this.attrMaps = [];
		for (j = 0; j < header.attrMapCount; ++ j) {
			this.attrMaps[j] = { attr: new Float32Array(data,
        (i + v + n + (u * header.uvMapCount) + (j * a) ) * 4, a) };
		}
	}
};

ION.FileMG2Header = function(stream) {
	stream.readInt32(); //magic "MG2H"
	this.vertexPrecision = stream.readFloat32();
	this.normalPrecision = stream.readFloat32();
	this.lowerBoundx = stream.readFloat32();
	this.lowerBoundy = stream.readFloat32();
	this.lowerBoundz = stream.readFloat32();
	this.higherBoundx = stream.readFloat32();
	this.higherBoundy = stream.readFloat32();
	this.higherBoundz = stream.readFloat32();
	this.divx = stream.readInt32();
	this.divy = stream.readInt32();
	this.divz = stream.readInt32();

	this.sizex = (this.higherBoundx - this.lowerBoundx) / this.divx;
	this.sizey = (this.higherBoundy - this.lowerBoundy) / this.divy;
	this.sizez = (this.higherBoundz - this.lowerBoundz) / this.divz;
};

ION.ReaderRAW = function() {
};

ION.ReaderRAW.prototype.read = function(stream, body) {
	this.readIndices(stream, body.indices);
	this.readVertices(stream, body.vertices);

	if (body.normals) {
		this.readNormals(stream, body.normals);
	}
	if (body.uvMaps) {
		this.readUVMaps(stream, body.uvMaps);
	}
	if (body.attrMaps) {
		this.readAttrMaps(stream, body.attrMaps);
	}
};

ION.ReaderRAW.prototype.readIndices = function(stream, indices) {
	stream.readInt32(); //magic "INDX"
	stream.readArrayInt32(indices);
};

ION.ReaderRAW.prototype.readVertices = function(stream, vertices) {
	stream.readInt32(); //magic "VERT"
	stream.readArrayFloat32(vertices);
};

ION.ReaderRAW.prototype.readNormals = function(stream, normals) {
	stream.readInt32(); //magic "NORM"
	stream.readArrayFloat32(normals);
};

ION.ReaderRAW.prototype.readUVMaps = function(stream, uvMaps) {
	var i = 0;
	for (; i < uvMaps.length; ++ i) {
		stream.readInt32(); //magic "TEXC"

		uvMaps[i].name = stream.readString();
		uvMaps[i].filename = stream.readString();
		stream.readArrayFloat32(uvMaps[i].uv);
	}
};

ION.ReaderRAW.prototype.readAttrMaps = function(stream, attrMaps) {
	var i = 0;
	for (; i < attrMaps.length; ++ i) {
		stream.readInt32(); //magic "ATTR"

		attrMaps[i].name = stream.readString();
		stream.readArrayFloat32(attrMaps[i].attr);
	}
};

ION.ReaderMG1 = function() {
};

ION.ReaderMG1.prototype.read = function(stream, body) {
	this.readIndices(stream, body.indices);
	this.readVertices(stream, body.vertices);

	if (body.normals) {
		this.readNormals(stream, body.normals);
	}
	if (body.uvMaps) {
		this.readUVMaps(stream, body.uvMaps);
	}
	if (body.attrMaps) {
		this.readAttrMaps(stream, body.attrMaps);
	}
};

ION.ReaderMG1.prototype.readIndices = function(stream, indices) {
	stream.readInt32(); //magic "INDX"
	stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(indices, 3);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

	ION.restoreIndices(indices, indices.length);
};

ION.ReaderMG1.prototype.readVertices = function(stream, vertices) {
	stream.readInt32(); //magic "VERT"
	stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(vertices, 1);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
};

ION.ReaderMG1.prototype.readNormals = function(stream, normals) {
	stream.readInt32(); //magic "NORM"
	stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(normals, 3);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
};

ION.ReaderMG1.prototype.readUVMaps = function(stream, uvMaps) {
	var i = 0;
	for (; i < uvMaps.length; ++ i) {
		stream.readInt32(); //magic "TEXC"

		uvMaps[i].name = stream.readString();
		uvMaps[i].filename = stream.readString();

		stream.readInt32(); //packed size

		var interleaved = new ION.InterleavedStream(uvMaps[i].uv, 2);
		LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
	}
};

ION.ReaderMG1.prototype.readAttrMaps = function(stream, attrMaps) {
	var i = 0;
	for (; i < attrMaps.length; ++ i) {
		stream.readInt32(); //magic "ATTR"

		attrMaps[i].name = stream.readString();

		stream.readInt32(); //packed size

		var interleaved = new ION.InterleavedStream(attrMaps[i].attr, 4);
		LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
	}
};

ION.ReaderMG2 = function() {
};

ION.ReaderMG2.prototype.read = function(stream, body) {
	this.MG2Header = new ION.FileMG2Header(stream);

	this.readVertices(stream, body.vertices);
	this.readIndices(stream, body.indices);

	if (body.normals) {
		this.readNormals(stream, body);
	}
	if (body.uvMaps) {
		this.readUVMaps(stream, body.uvMaps);
	}
	if (body.attrMaps) {
		this.readAttrMaps(stream, body.attrMaps);
	}
};

ION.ReaderMG2.prototype.readVertices = function(stream, vertices) {
	var magic=stream.readInt32(); //magic "VERT"
	var sz=stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(vertices, 3);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

	var gridIndices = this.readGridIndices(stream, vertices);

	ION.restoreVertices(vertices, this.MG2Header, gridIndices, this.MG2Header.vertexPrecision);
};

ION.ReaderMG2.prototype.readGridIndices = function(stream, vertices) {
	var magic=stream.readInt32(); //magic "GIDX"
	var sz=stream.readInt32(); //packed size

	var gridIndices = new Uint32Array(vertices.length / 3);

	var interleaved = new ION.InterleavedStream(gridIndices, 1);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

	ION.restoreGridIndices(gridIndices, gridIndices.length);

	return gridIndices;
};

ION.ReaderMG2.prototype.readIndices = function(stream, indices) {
	stream.readInt32(); //magic "INDX"
	stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(indices, 3);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

	ION.restoreIndices(indices, indices.length);
};

ION.ReaderMG2.prototype.readNormals = function(stream, body) {
	stream.readInt32(); //magic "NORM"
	stream.readInt32(); //packed size

	var interleaved = new ION.InterleavedStream(body.normals, 3);
	LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

	var smooth = ION.calcSmoothNormals(body.indices, body.vertices);

	ION.restoreNormals(body.normals, smooth, this.MG2Header.normalPrecision);
};

ION.ReaderMG2.prototype.readUVMaps = function(stream, uvMaps) {
	var i = 0;
	for (; i < uvMaps.length; ++ i) {
		stream.readInt32(); //magic "TEXC"

		uvMaps[i].name = stream.readString();
		uvMaps[i].filename = stream.readString();

		var precision = stream.readFloat32();

		stream.readInt32(); //packed size

		var interleaved = new ION.InterleavedStream(uvMaps[i].uv, 2);
		LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

		ION.restoreMap(uvMaps[i].uv, 2, precision);
	}
};

ION.ReaderMG2.prototype.readAttrMaps = function(stream, attrMaps) {
	var i = 0;
	for (; i < attrMaps.length; ++ i) {
		stream.readInt32(); //magic "ATTR"

		attrMaps[i].name = stream.readString();

		var precision = stream.readFloat32();

		stream.readInt32(); //packed size

		var interleaved = new ION.InterleavedStream(attrMaps[i].attr, 4);
		LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

		ION.restoreMap(attrMaps[i].attr, 4, precision);
	}
};

ION.restoreIndices = function(indices, len) {
	var i = 3;
	if (len > 0) {
		indices[2] += indices[0];
		indices[1] += indices[0];
	}
	for (; i < len; i += 3) {
		indices[i] += indices[i - 3];

		if (indices[i] === indices[i - 3]) {
			indices[i + 1] += indices[i - 2];
		}else {
			indices[i + 1] += indices[i];
		}

		indices[i + 2] += indices[i];
	}
};

ION.restoreGridIndices = function(gridIndices, len) {
	var i = 1;
	for (; i < len; ++ i) {
		gridIndices[i] += gridIndices[i - 1];
	}
};

ION.restoreVertices = function(vertices, grid, gridIndices, precision) {
	var gridIdx, delta, x, y, z,
      intVertices = new Uint32Array(vertices.buffer, vertices.byteOffset, vertices.length),
      ydiv = grid.divx, zdiv = ydiv * grid.divy,
      prevGridIdx = 0x7fffffff, prevDelta = 0,
      i = 0, j = 0, len = gridIndices.length;

	for (; i < len; j += 3) {
		x = gridIdx = gridIndices[i ++];

		z = ~~(x / zdiv);
		x -= ~~(z * zdiv);
		y = ~~(x / ydiv);
		x -= ~~(y * ydiv);

		delta = intVertices[j];
		if (gridIdx === prevGridIdx) {
			delta += prevDelta;
		}

		vertices[j]     = grid.lowerBoundx +
      x * grid.sizex + precision * delta;
		vertices[j + 1] = grid.lowerBoundy +
      y * grid.sizey + precision * intVertices[j + 1];
		vertices[j + 2] = grid.lowerBoundz +
      z * grid.sizez + precision * intVertices[j + 2];

		prevGridIdx = gridIdx;
		prevDelta = delta;
	}
};

ION.restoreNormals = function(normals, smooth, precision) {
	var ro, phi, theta, sinPhi,
      nx, ny, nz, by, bz, len,
      intNormals = new Uint32Array(normals.buffer, normals.byteOffset, normals.length),
      i = 0, k = normals.length,
      PI_DIV_2 = 3.141592653589793238462643 * 0.5;

	for (; i < k; i += 3) {
		ro = intNormals[i] * precision;
		phi = intNormals[i + 1];

		if (phi === 0) {
			normals[i]     = smooth[i]     * ro;
			normals[i + 1] = smooth[i + 1] * ro;
			normals[i + 2] = smooth[i + 2] * ro;
		}else {

			if (phi <= 4) {
				theta = (intNormals[i + 2] - 2) * PI_DIV_2;
			}else {
				theta = ( (intNormals[i + 2] * 4 / phi) - 2) * PI_DIV_2;
			}

			phi *= precision * PI_DIV_2;
			sinPhi = ro * Math.sin(phi);

			nx = sinPhi * Math.cos(theta);
			ny = sinPhi * Math.sin(theta);
			nz = ro * Math.cos(phi);

			bz = smooth[i + 1];
			by = smooth[i] - smooth[i + 2];

			len = Math.sqrt(2 * bz * bz + by * by);
			if (len > 1e-20) {
				by /= len;
				bz /= len;
			}

			normals[i]     = smooth[i]     * nz +
        (smooth[i + 1] * bz - smooth[i + 2] * by) * ny - bz * nx;
			normals[i + 1] = smooth[i + 1] * nz -
        (smooth[i + 2]      + smooth[i]   ) * bz  * ny + by * nx;
			normals[i + 2] = smooth[i + 2] * nz +
        (smooth[i]     * by + smooth[i + 1] * bz) * ny + bz * nx;
		}
	}
};

ION.restoreMap = function(map, count, precision) {
	var delta, value,
      intMap = new Uint32Array(map.buffer, map.byteOffset, map.length),
      i = 0, j, len = map.length;

	for (; i < count; ++ i) {
		delta = 0;

		for (j = i; j < len; j += count) {
			value = intMap[j];

			delta += value & 1 ? -( (value + 1) >> 1) : value >> 1;

			map[j] = delta * precision;
		}
	}
};

ION.calcSmoothNormals = function(indices, vertices) {
	var smooth = new Float32Array(vertices.length),
      indx, indy, indz, nx, ny, nz,
      v1x, v1y, v1z, v2x, v2y, v2z, len,
      i, k;

	for (i = 0, k = indices.length; i < k;) {
		indx = indices[i ++] * 3;
		indy = indices[i ++] * 3;
		indz = indices[i ++] * 3;

		v1x = vertices[indy]     - vertices[indx];
		v2x = vertices[indz]     - vertices[indx];
		v1y = vertices[indy + 1] - vertices[indx + 1];
		v2y = vertices[indz + 1] - vertices[indx + 1];
		v1z = vertices[indy + 2] - vertices[indx + 2];
		v2z = vertices[indz + 2] - vertices[indx + 2];

		nx = v1y * v2z - v1z * v2y;
		ny = v1z * v2x - v1x * v2z;
		nz = v1x * v2y - v1y * v2x;

		len = Math.sqrt(nx * nx + ny * ny + nz * nz);
		if (len > 1e-10) {
			nx /= len;
			ny /= len;
			nz /= len;
		}

		smooth[indx]     += nx;
		smooth[indx + 1] += ny;
		smooth[indx + 2] += nz;
		smooth[indy]     += nx;
		smooth[indy + 1] += ny;
		smooth[indy + 2] += nz;
		smooth[indz]     += nx;
		smooth[indz + 1] += ny;
		smooth[indz + 2] += nz;
	}

	for (i = 0, k = smooth.length; i < k; i += 3) {
	        v1x=smooth[i];v1y=smooth[i + 1];v1z=smooth[i + 2];
		len = Math.sqrt(v1x*v1x + v1y*v1y + v1z*v1z);

		if (len > 1e-10) {
			smooth[i]     =v1x/ len;
			smooth[i+1] =v1y/ len;
			smooth[i+2] =v1z/ len;
		}
	}

	return smooth;
};

ION.isLittleEndian = (function() {
	var buffer = new ArrayBuffer(2),
      bytes = new Uint8Array(buffer),
      ints = new Uint16Array(buffer);

	bytes[0] = 1;

	return ints[0] === 1;
}());

ION.InterleavedStream = function(data, count) {
	this.data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	this.offset = ION.isLittleEndian ? 3 : 0;
	this.count = count * 4;
	this.len = this.data.length;
};

ION.InterleavedStream.prototype.writeByte = function(value) {
	this.data[this.offset] = value;

	this.offset += this.count;
	if (this.offset >= this.len) {

		this.offset -= this.len - 4;
		if (this.offset >= this.count) {

			this.offset -= this.count + (ION.isLittleEndian ? 1 : -1);
		}
	}
};

ION.Stream = function(data) {
	this.data = data;
	this.offset = 0;
};

ION.Stream.prototype.TWO_POW_MINUS23 = Math.pow(2, -23);

ION.Stream.prototype.TWO_POW_MINUS126 = Math.pow(2, -126);

ION.Stream.prototype.readByte = function() {
	return this.data[this.offset ++] & 0xff;
};

ION.Stream.prototype.readInt32 = function() {
	var i = this.readByte();
	i |= this.readByte() << 8;
	i |= this.readByte() << 16;
	return i | (this.readByte() << 24);
};

ION.Stream.prototype.readFloat32 = function() {
	var m = this.readByte();
	m += this.readByte() << 8;

	var b1 = this.readByte();
	var b2 = this.readByte();

	m += (b1 & 0x7f) << 16;
	var e = ( (b2 & 0x7f) << 1) | ( (b1 & 0x80) >>> 7);
	var s = b2 & 0x80 ? -1 : 1;

	if (e === 255) {
		return m !== 0 ? NaN : s * Infinity;
	}
	if (e > 0) {
		return s * (1 + (m * this.TWO_POW_MINUS23) ) * Math.pow(2, e - 127);
	}
	if (m !== 0) {
		return s * m * this.TWO_POW_MINUS126;
	}
	return s * 0;
};

ION.Stream.prototype.readString = function() {
	var len = this.readInt32();

	this.offset += len;

	return String.fromCharCode.apply(null, this.data.subarray(this.offset - len, this.offset));
};

ION.Stream.prototype.readArrayInt32 = function(array) {
	var i = 0, len = array.length;

	while (i < len) {
		array[i ++] = this.readInt32();
	}

	return array;
};

ION.Stream.prototype.readArrayFloat32 = function(array) {
	var i = 0, len = array.length;

	while (i < len) {
		array[i ++] = this.readFloat32();
	}

	return array;
};



/**
 * Loader for ION encoded models generated by FinalMesh tool:
 */

THREE.IONLoader = function () {

	THREE.Loader.call( this );

	// Deprecated

	Object.defineProperties( this, {
		statusDomElement: {
			get: function () {

				if ( this._statusDomElement === undefined ) {

					this._statusDomElement = document.createElement( 'div' );

				}

				console.warn( 'THREE.BinaryLoader: .statusDomElement has been removed.' );
				return this._statusDomElement;

			}
		},
	} );

};

THREE.IONLoader.prototype = Object.create( THREE.Loader.prototype );
THREE.IONLoader.prototype.constructor = THREE.IONLoader;

// Load multiple ION parts defined in JSON

THREE.IONLoader.prototype.loadParts = function( url, callback, parameters ) {

	parameters = parameters || {};

	var scope = this;

	var xhr = new XMLHttpRequest();

	var basePath = parameters.basePath ? parameters.basePath : this.extractUrlBase( url );

	xhr.onreadystatechange = function() {

		if ( xhr.readyState === 4 ) {

			if ( xhr.status === 200 || xhr.status === 0 ) {

				var jsonObject = JSON.parse( xhr.responseText );

				var materials = [], geometries = [], counter = 0;

				function callbackFinal( geometry ) {

					counter += 1;

					geometries.push( geometry );

					if ( counter === jsonObject.offsets.length ) {

						callback( geometries, materials );

					}

				}


				// init materials

				for ( var i = 0; i < jsonObject.materials.length; i ++ ) {

					materials[ i ] = scope.createMaterial( jsonObject.materials[ i ], basePath );

				}

				// load joined ION file

				var partUrl = basePath + jsonObject.data;
				var parametersPart = { useWorker: parameters.useWorker, offsets: jsonObject.offsets };
				scope.load( partUrl, callbackFinal, parametersPart );

			}

		}

	};

	xhr.open( "GET", url, true );
	xhr.setRequestHeader( "Content-Type", "text/plain" );
	xhr.send( null );

};

// Load IONLoader compressed models
//	- parameters
//		- url (required)
//		- callback (required)

THREE.IONLoader.prototype.load = function( url, callback, parameters ) {

	parameters = parameters || {};

	var scope = this;

	var offsets = parameters.offsets !== undefined ? parameters.offsets : [ 0 ];

	var xhr = new XMLHttpRequest(),
		callbackProgress = null;

	var length = 0;

	xhr.onreadystatechange = function() {

		if ( xhr.readyState === 4 ) {

			if ( xhr.status === 200 || xhr.status === 0 ) {

				var binaryData = new Uint8Array(xhr.response);

				var s = Date.now();

				if ( parameters.useWorker ) {

					var worker = parameters.worker || new Worker( "js/loaders/ion/IONWorker.js" );

					worker.onmessage = function( event ) {

						var files = event.data;

						for ( var i = 0; i < files.length; i ++ ) {

							var ionFile = files[ i ];

							var e1 = Date.now();
							console.log( "ION data parse time [worker]: " + (e1-s) + " ms" );

							scope.createModel( ionFile, callback );

							var e = Date.now();
							console.log( "model load time [worker]: " + (e - e1) + " ms, total: " + (e - s));

						}


					};

					worker.postMessage( { "data": binaryData, "offsets": offsets } );

				} else {

					for ( var i = 0; i < offsets.length; i ++ ) {

						var stream = new ION.Stream( binaryData );
						stream.offset = offsets[ i ];

						var ionFile = new ION.File( stream );

						scope.createModel( ionFile, callback );

					}

					var e = Date.now();
					console.log( "ION data parse time [inline]: " + (e-s) + " ms" );

				}

			} else {

				console.error( "Couldn't load [" + url + "] [" + xhr.status + "]" );

			}

		} else if ( xhr.readyState === 3 ) {

			if ( callbackProgress ) {

				if ( length === 0 ) {

					length = xhr.getResponseHeader( "Content-Length" );

				}

				callbackProgress( { total: length, loaded: xhr.responseText.length } );

			}

		} else if ( xhr.readyState === 2 ) {

			length = xhr.getResponseHeader( "Content-Length" );

		}

	};

	xhr.open( "GET", url, true );
	xhr.responseType = "arraybuffer";

	xhr.send( null );

};


THREE.IONLoader.prototype.createModel = function ( file, callback ) {

	var Model = function () {

		THREE.BufferGeometry.call( this );

		this.materials = [];

		var indices = file.body.indices,
		positions = file.body.vertices,
		normals = file.body.normals;

		var uvs0,uvs1, colors;

		var uvMaps = file.body.uvMaps;

		if ( uvMaps !== undefined && uvMaps.length > 0 ) {

			uvs0 = uvMaps[ 0 ].uv;
			if(uvMaps.length > 1)
			uvs1 = uvMaps[ 1 ].uv;

		}

		var attrMaps = file.body.attrMaps;

		if ( attrMaps !== undefined && attrMaps.length > 0 && attrMaps[ 0 ].name === 'Color' ) {

			colors = attrMaps[ 0 ].attr;

		}

		this.setIndex( new THREE.BufferAttribute( indices, 1 ) );
		this.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

		if ( normals !== undefined ) {

			this.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

		}

		if ( uvs0)this.addAttribute( 'uv', new THREE.BufferAttribute( uvs0, 2 ) );

        if ( uvs1)this.addAttribute( 'uv2', new THREE.BufferAttribute( uvs1, 2 ) );

		if ( colors !== undefined ) {

			this.addAttribute( 'color', new THREE.BufferAttribute( colors, 4 ) );

		}
        if(file.header.comment )
        {
            var meta=JSON.parse(file.header.comment);
            if(meta && meta.r)
            {
                for(var i=0;i<meta.r.length;i++)
                {
                    var g=meta.r[i];
		    // g.m - material is name of material
		    var mtlId=0;

		    if(g.m=="mat_ID1")mtlId=0;else
            if(g.m=="mat_ID2")mtlId=1;else
            if(g.m=="mat_ID3")mtlId=2;else
            if(g.m=="mat_ID4")mtlId=3;else
            if(g.m=="mat_ID5")mtlId=4;else
            if(g.m=="mat_ID6")mtlId=5;else
            if(g.m=="mat_ID7")mtlId=6;else
            if(g.m=="mat_ID8")mtlId=7;else
            if(g.m=="mat_ID9")mtlId=8;else
            if(g.m=="mat_ID10")mtlId=9;else
            if(g.m=="mat_ID11")mtlId=10;else
            if(g.m=="mat_ID12")mtlId=11;else
            if(g.m=="mat_ID13")mtlId=12;else
            if(g.m=="mat_ID14")mtlId=13;else
            if(g.m=="mat_ID15")mtlId=14;else
            if(g.m=="mat_ID16")mtlId=15;else
            if(g.m=="mat_ID17")mtlId=16;else
            if(g.m=="mat_ID18")mtlId=17;else
            if(g.m=="mat_ID19")mtlId=18;else
            if(g.m=="mat_ID20")mtlId=19;else
            if(g.m=="mat_ID21")mtlId=20;else
            if(g.m=="mat_ID22")mtlId=21;else
            if(g.m=="mat_ID23")mtlId=22;else
            if(g.m=="mat_ID24")mtlId=23;else
            if(g.m=="mat_ID25")mtlId=24;

                this.addGroup(g.a*3,(g.b-g.a)*3,mtlId);

                }
            }
        }

	}

	Model.prototype = Object.create( THREE.BufferGeometry.prototype );
	Model.prototype.constructor = Model;

	var geometry = new Model();

	// compute vertex normals if not present in the ION model
	if ( geometry.attributes.normal === undefined ) {
		geometry.computeVertexNormals();
	}

	callback( geometry );

};



//importScripts( "lzma.js", "ctm.js" );
/*
self.onmessage = function( event ) {

	var files = [];

	for ( var i = 0; i < event.data.offsets.length; i ++ ) {

		var stream = new ION.Stream( event.data.data );
		stream.offset = event.data.offsets[ i ];

		files[ i ] = new ION.File( stream );

	}

	self.postMessage( files );
	self.close();

};
*/





// use to minify http://www.jscompressor.com/
/* constant tables (inflate) */

var ZIP={
	MASK_BITS:[
    0x0000,
    0x0001, 0x0003, 0x0007, 0x000f, 0x001f, 0x003f, 0x007f, 0x00ff,
    0x01ff, 0x03ff, 0x07ff, 0x0fff, 0x1fff, 0x3fff, 0x7fff, 0xffff],
// Tables for deflate from PKZIP's appnote.txt.
	cplens:[ // Copy lengths for literal codes 257..285
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0],
/* note: see note #13 above about the 258 in this list. */
	cplext:[ // Extra bits for literal codes 257..285
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 99, 99], // 99==invalid
	cpdist:[ // Copy offsets for distance codes 0..29
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577],

	cpdext:[ // Extra bits for distance codes
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
    12, 12, 13, 13],
	b:[  // Order of the bit length code lengths
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
	inflateBin:function(src,offset,size)
	{
		var z=new zip(src,offset);
		return z.inflateBin(size)
	},
	inflateStr:function(src,size)
	{
		var z=new zip(src);
		return z.inflateStr(size)
	},
    HuftNode:function () {
	this.e=0; // number of extra bits or operation
	this.b=0; // number of bits in this code or subcode

	// union
	this.n=0; // literal, length base, or distance base
	this.t=null; // (ZIP.HuftNode) pointer to next level of table
    },
    HuftList:function () {//zip_HuftList
	this.next=null;
	this.list=null;
},
//zip_HuftBuild
HuftBuild:function(b,	// code lengths in bits (all assumed <= BMAX)
		       n,	// number of codes (assumed <= N_MAX)
		       s,	// number of simple-valued codes (0..s-1)
		       d,	// list of base values for non-simple codes
		       e,	// list of extra bits for non-simple codes
		       mm	// maximum lookup bits
		   ) {
    //this.BMAX = 16;   // maximum bit length of any code
    this.N_MAX = 288; // maximum number of codes in any set
    this.status = 0;	// 0: success, 1: incomplete table, 2: bad input
    this.root = null;	// (ZIP.HuftList) starting table
    this.m = 0;		// maximum lookup bits, returns actual

/* Given a list of code lengths and a maximum table size, make a set of
   tables to decode that set of codes.	Return zero on success, one if
   the given code set is incomplete (the tables are still built in this
   case), two if the input is invalid (all zero length codes or an
   oversubscribed set of lengths), and three if not enough memory.
   The code with value 256 is special, and the tables are constructed
   so that no bits beyond that code are fetched when that code is
   decoded. */
    {
	var a;			// counter for codes of length k
	var c = new Array(16+1);	// bit length count table
	var el;			// length of EOB code (value 256)
	var f;			// i repeats in table every f entries
	var g;			// maximum code length
	var h;			// table level
	var i;			// counter, current code
	var j;			// counter
	var k;			// number of bits in current code
	var lx = new Array(16+1);	// stack of bits per table
	var p;			// pointer into c[], b[], or v[]
	var pidx;		// index of p
	var q;			// (ZIP.HuftNode) points to current table
	var r = new ZIP.HuftNode(); // table entry for structure assignment
	var u = new Array(16); // ZIP.HuftNode[BMAX][]  table stack
	var v = new Array(this.N_MAX); // values in order of bit length
	var w;
	var x = new Array(16+1);// bit offsets, then code stack
	var xp;			// pointer into x or c
	var y;			// number of dummy codes added
	var z;			// number of entries in current table
	var o;
	var tail;		// (ZIP.HuftList)

	tail = this.root = null;
	for(i = 0; i < c.length; i++)
	    c[i] = 0;
	for(i = 0; i < lx.length; i++)
	    lx[i] = 0;
	for(i = 0; i < u.length; i++)
	    u[i] = null;
	for(i = 0; i < v.length; i++)
	    v[i] = 0;
	for(i = 0; i < x.length; i++)
	    x[i] = 0;

	// Generate counts for each bit length
	el = n > 256 ? b[256] : 16; // set length of EOB code, if any
	p = b; pidx = 0;
	i = n;
	do {
	    c[p[pidx]]++;	// assume all entries <= BMAX
	    pidx++;
	} while(--i > 0);
	if(c[0] == n) {	// null input--all zero length codes
	    this.root = null;
	    this.m = 0;
	    this.status = 0;
	    return;
	}

	// Find minimum and maximum length, bound *m by those
	for(j = 1; j <= 16; j++)
	    if(c[j] != 0)
		break;
	k = j;			// minimum code length
	if(mm < j)
	    mm = j;
	for(i = 16; i != 0; i--)
	    if(c[i] != 0)
		break;
	g = i;			// maximum code length
	if(mm > i)
	    mm = i;

	// Adjust last length count to fill out codes, if needed
	for(y = 1 << j; j < i; j++, y <<= 1)
	    if((y -= c[j]) < 0) {
		this.status = 2;	// bad input: more codes than bits
		this.m = mm;
		return;
	    }
	if((y -= c[i]) < 0) {
	    this.status = 2;
	    this.m = mm;
	    return;
	}
	c[i] += y;

	// Generate starting offsets into the value table for each length
	x[1] = j = 0;
	p = c;
	pidx = 1;
	xp = 2;
	while(--i > 0)		// note that i == g from above
	    x[xp++] = (j += p[pidx++]);

	// Make a table of values in order of bit lengths
	p = b; pidx = 0;
	i = 0;
	do {
	    if((j = p[pidx++]) != 0)
		v[x[j]++] = i;
	} while(++i < n);
	n = x[g];			// set n to length of v

	// Generate the Huffman codes and for each, make the table entries
	x[0] = i = 0;		// first Huffman code is zero
	p = v; pidx = 0;		// grab values in bit order
	h = -1;			// no tables yet--level -1
	w = lx[0] = 0;		// no bits decoded yet
	q = null;			// ditto
	z = 0;			// ditto

	// go through the bit lengths (k already is bits in shortest code)
	for(; k <= g; k++) {
	    a = c[k];
	    while(a-- > 0) {
		// here i is the Huffman code of length k bits for value p[pidx]
		// make tables up to required level
		while(k > w + lx[1 + h]) {
		    w += lx[1 + h]; // add bits already decoded
		    h++;

		    // compute minimum size table less than or equal to *m bits
		    z = (z = g - w) > mm ? mm : z; // upper limit
		    if((f = 1 << (j = k - w)) > a + 1) { // try a k-w bit table
			// too few codes for k-w bit table
			f -= a + 1;	// deduct codes from patterns left
			xp = k;
			while(++j < z) { // try smaller tables up to z bits
			    if((f <<= 1) <= c[++xp])
				break;	// enough codes to use up j bits
			    f -= c[xp];	// else deduct codes from patterns
			}
		    }
		    if(w + j > el && w < el)
			j = el - w;	// make EOB code end at table
		    z = 1 << j;	// table entries for j-bit table
		    lx[1 + h] = j; // set table size in stack

		    // allocate and link in new table
		    q = new Array(z);
		    for(o = 0; o < z; o++) {
			q[o] = new ZIP.HuftNode();
		    }

		    if(tail == null)
			tail = this.root = new ZIP.HuftList();
		    else
			tail = tail.next = new ZIP.HuftList();
		    tail.next = null;
		    tail.list = q;
		    u[h] = q;	// table starts after link

		    /* connect to last table, if there is one */
		    if(h > 0) {
			x[h] = i;		// save pattern for backing up
			r.b = lx[h];	// bits to dump before this table
			r.e = 16 + j;	// bits in this table
			r.t = q;		// pointer to this table
			j = (i & ((1 << w) - 1)) >> (w - lx[h]);
			u[h-1][j].e = r.e;
			u[h-1][j].b = r.b;
			u[h-1][j].n = r.n;
			u[h-1][j].t = r.t;
		    }
		}

		// set up table entry in r
		r.b = k - w;
		if(pidx >= n)
		    r.e = 99;		// out of values--invalid code
		else if(p[pidx] < s) {
		    r.e = (p[pidx] < 256 ? 16 : 15); // 256 is end-of-block code
		    r.n = p[pidx++];	// simple code is just the value
		} else {
		    r.e = e[p[pidx] - s];	// non-simple--look up in lists
		    r.n = d[p[pidx++] - s];
		}

		// fill code-like entries with r //
		f = 1 << (k - w);
		for(j = i >> w; j < z; j += f) {
		    q[j].e = r.e;
		    q[j].b = r.b;
		    q[j].n = r.n;
		    q[j].t = r.t;
		}

		// backwards increment the k-bit code i
		for(j = 1 << (k - 1); (i & j) != 0; j >>= 1)
		    i ^= j;
		i ^= j;

		// backup over finished tables
		while((i & ((1 << w) - 1)) != x[h]) {
		    w -= lx[h];		// don't need to update q
		    h--;
		}
	    }
	}

	/* return actual size of base table */
	this.m = lx[1];

	/* Return true (1) if we were given an incomplete table */
	this.status = ((y != 0 && g != 1) ? 1 : 0);
    } /* end of constructor */
}

};


function zip(src,offset) {
	this.WSIZE = 32768;		// Sliding Window size
	this.LBITS = 9; 		// bits in base literal/length lookup table
	this.DBITS = 6; 		// bits in base distance lookup table

	//this.slide=new Array(2*this.WSIZE);
    this.slide=new Uint8Array(2*this.WSIZE);
	this.wp=0;
	this.bitBuf=0;
	this.bitLen=0;
	this.method=-1;
	this.eof=false;
	this.copyLen=this.zip_copy_dist=0;
	this.tl=null;
	this.pos=0;
    this.offset=offset;
	this.src=src;
    this.srcLength=src.byteLength;
	this.STORED_BLOCK = 0;
	this.fixedTL = null;	// inflate static
    this.MASK_BITS=ZIP.MASK_BITS;
}



/* routines (inflate) */

zip.prototype.getByte=function () {
    /*
    var b=this.src[this.pos+this.offset];
    this.pos++;
    return b;*/
    return this.src[this.pos++  +this.offset];
}

zip.prototype.needBits=function(n) {
    while(this.bitLen < n) {
	this.bitBuf |= this.getByte() << this.bitLen;
	this.bitLen += 8;
    }
}

zip.prototype.getBits=function(n) {
    return this.bitBuf & this.MASK_BITS[n];
}

zip.prototype.ngb=function(n) {
    while(this.bitLen < n) {
	this.bitBuf |= this.getByte() << this.bitLen;
	this.bitLen += 8;
    }
    return this.bitBuf & ZIP.MASK_BITS[n];
}


zip.prototype.dumpBits=function (n) {
    this.bitBuf >>= n;
    this.bitLen -= n;
}

zip.prototype.inflateCodes=function(buff, off, size) {
    /* inflate (decompress) the codes in a deflated (compressed) block.
       Return an error code or zero if it all goes ok. */
    var e,		// table entry flag/number of extra bits
        t,		// (ZIP.HuftNode) pointer to table entry
    n=0;

    if(size == 0)
      return 0;

    // inflate the coded data

    for(;;) {			// do until end of block

     t = this.tl.list[this.ngb(this.zip_bl)];

	e = t.e;
	while(e > 16) {
	    if(e == 99)
		return -1;
	    this.dumpBits(t.b);
	    //e -= 16;
        t = t.t[this.ngb(e-16)];
	    e = t.e;
	}
	this.dumpBits(t.b);

	if(e == 16) {		// then it's a literal
	    this.wp &= /*this.WSIZE - 1*/ 32767;
	    buff[off + n++] = this.slide[this.wp++] = t.n;
	    if(n == size)
		return size;
	    continue;
	}

	// exit if end of block
	if(e == 15)
	    break;

	// it's an EOB or a length

	// get length of block to copy
     this.copyLen = t.n + this.ngb(e);
	this.dumpBits(e);

	// decode distance of block to copy
     t = this.zip_td.list[this.ngb(this.zip_bd)];

	e = t.e;

	while(e > 16) {
	    if(e == 99)
		return -1;
	    this.dumpBits(t.b);
	    //e -= 16;
        t = t.t[this.ngb(e-16)];
	    e = t.e;
	}
	this.dumpBits(t.b);

	this.zip_copy_dist = this.wp - t.n - this.ngb(e);
	this.dumpBits(e);

	// do the copy

	while(this.copyLen > 0 && n < size) {
	    this.copyLen--;
	    this.zip_copy_dist &= 32767/*this.WSIZE - 1*/;
	    this.wp &= 32767 /*this.WSIZE - 1*/;
	    buff[off + n++] = this.slide[this.wp++]	= this.slide[this.zip_copy_dist++];
	}

	if(n == size)
	    return size;
    }

    this.method = -1; // done
    return n;
}

zip.prototype.inflateStored=function (buff, off, size) {
    /* "decompress" an inflated type 0 (stored) block. */
    var n;

    // go to byte boundary
    n = this.bitLen & 7;
    this.dumpBits(n);

    // get the length and its complement

    n = this.ngb(16);
    this.dumpBits(16);
    this.needBits(16);
    if(n != ((~this.bitBuf) & 0xffff))
	return -1;			// error in compressed data
    this.dumpBits(16);

    // read and output the compressed data
    this.copyLen = n;

    n = 0;
    while(this.copyLen > 0 && n < size) {
	this.copyLen--;
	this.wp &= 32767/*this.WSIZE - 1*/;
	buff[off + n++] = this.slide[this.wp++] =    this.ngb(8);
	this.dumpBits(8);
    }

    if(this.copyLen == 0)
      this.method = -1; // done
    return n;
}

zip.prototype.inflateFixed=function(buff, off, size) {
    /* decompress an inflated type 1 (fixed Huffman codes) block.  We should
       either replace this with a custom decoder, or at least precompute the
       Huffman tables. */

    // if first time, set up tables for fixed blocks
    if(this.fixedTL == null) {
	var i;			// temporary variable
	var l = new Array(288);	// length list for huft_build
	var h;	// zip_HuftBuild

	// literal table
	for(i = 0; i < 144; i++)
	    l[i] = 8;
	for(; i < 256; i++)
	    l[i] = 9;
	for(; i < 280; i++)
	    l[i] = 7;
	for(; i < 288; i++)	// make a complete, but wrong code set
	    l[i] = 8;
	this.zip_fixed_bl = 7;

	h = new ZIP.HuftBuild(l, 288, 257, ZIP.cplens, ZIP.cplext,
			      this.zip_fixed_bl);
	if(h.status != 0) {
	    alert("HufBuild error: "+h.status);
	    return -1;
	}
	this.fixedTL = h.root;
	this.zip_fixed_bl = h.m;

	// distance table
	for(i = 0; i < 30; i++)	// make an incomplete code set
	    l[i] = 5;
	this.zip_fixed_bd = 5;

	h = new ZIP.HuftBuild(l, 30, 0, ZIP.cpdist, ZIP.cpdext, this.zip_fixed_bd);
	if(h.status > 1) {
	    this.fixedTL = null;
	    alert("HufBuild error: "+h.status);
	    return -1;
	}
	this.zip_fixed_td = h.root;
	this.zip_fixed_bd = h.m;
    }

    this.tl = this.fixedTL;
    this.zip_td = this.zip_fixed_td;
    this.zip_bl = this.zip_fixed_bl;
    this.zip_bd = this.zip_fixed_bd;
    return this.inflateCodes(buff, off, size);
}

zip.prototype.inflateDynamic=function(buff, off, size) {
    // decompress an inflated type 2 (dynamic Huffman codes) block.
    var i;		// temporary variables
    var j;
    var l;		// last length
    var n;		// number of lengths to get
    var t;		// (ZIP.HuftNode) literal/length code table
    var nb;		// number of bit length codes
    var nl;		// number of literal/length codes
    var nd;		// number of distance codes
    var ll = new Array(286+30); // literal/length and distance code lengths
    var h;		// (ZIP.HuftBuild)

    for(i = 0; i < ll.length; i++)
	ll[i] = 0;

    // read in table lengths

    nl = 257 + this.ngb(5);	// number of literal/length codes
    this.dumpBits(5);

    nd = 1 + this.ngb(5);	// number of distance codes
    this.dumpBits(5);

    nb = 4 + this.ngb(4);	// number of bit length codes
    this.dumpBits(4);
    if(nl > 286 || nd > 30)
      return -1;		// bad lengths

    // read in bit-length-code lengths
    for(j = 0; j < nb; j++)
    {

	ll[ZIP.b[j]] = this.ngb(3);
	this.dumpBits(3);
    }
    for(; j < 19; j++)
	ll[ZIP.b[j]] = 0;

    // build decoding table for trees--single level, 7 bit lookup
    this.zip_bl = 7;
    h = new ZIP.HuftBuild(ll, 19, 19, null, null, this.zip_bl);
    if(h.status != 0)
	return -1;	// incomplete code set

    this.tl = h.root;
    this.zip_bl = h.m;

    // read in literal and distance code lengths
    n = nl + nd;
    i = l = 0;
    while(i < n) {

	t = this.tl.list[this.ngb(this.zip_bl)];
	j = t.b;
	this.dumpBits(j);
	j = t.n;
	if(j < 16)		// length of code in bits (0..15)
	    ll[i++] = l = j;	// save last length in l
	else if(j == 16) {	// repeat last length 3 to 6 times

	    j = 3 + this.ngb(2);
	    this.dumpBits(2);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = l;
	} else if(j == 17) {	// 3 to 10 zero length codes

	    j = 3 + this.ngb(3);
	    this.dumpBits(3);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = 0;
	    l = 0;
	} else {		// j == 18: 11 to 138 zero length codes

	    j = 11 + this.ngb(7);
	    this.dumpBits(7);
	    if(i + j > n)
		return -1;
	    while(j-- > 0)
		ll[i++] = 0;
	    l = 0;
	}
    }

    // build the decoding tables for literal/length and distance codes
    this.zip_bl = this.LBITS;
    h = new ZIP.HuftBuild(ll, nl, 257, ZIP.cplens, ZIP.cplext, this.zip_bl);
    if(this.zip_bl == 0)	// no literals or lengths
	h.status = 1;
    if(h.status != 0) {
	if(h.status == 1)
	    ;// **incomplete literal tree**
	return -1;		// incomplete code set
    }
    this.tl = h.root;
    this.zip_bl = h.m;

    for(i = 0; i < nd; i++)
	ll[i] = ll[i + nl];
    this.zip_bd = this.DBITS;
    h = new ZIP.HuftBuild(ll, nd, 0, ZIP.cpdist, ZIP.cpdext, this.zip_bd);
    this.zip_td = h.root;
    this.zip_bd = h.m;

    if(this.zip_bd == 0 && nl > 257) {   // lengths but no distances
	// **incomplete distance tree**
	return -1;
    }

    if(h.status == 1) {
	;// **incomplete distance tree**
    }
    if(h.status != 0)
	return -1;

    // decompress until an end-of-block code
    return this.inflateCodes(buff, off, size);
}


zip.prototype.inflateInternal=function(buff,off,size) {
	// decompress an inflated entry
	var n,i;

	n=0;
	while(n<size) {
		if(this.eof&&this.method==-1)
			return n;

		if(this.copyLen>0) {
			if(this.method!=this.STORED_BLOCK) {
				// STATIC_TREES or DYN_TREES
				while(this.copyLen>0&&n<size) {
					this.copyLen--;
					this.zip_copy_dist&= 32767/*this.WSIZE-1*/;
					this.wp&=32767 /*this.WSIZE-1*/;
					buff[off+n++]=this.slide[this.wp++]=
					this.slide[this.zip_copy_dist++];
				}
			} else {
				while(this.copyLen>0&&n<size) {
					this.copyLen--;
					this.wp&=32767/*this.WSIZE-1*/;

					buff[off+n++]=this.slide[this.wp++]=this.ngb(8);
					this.dumpBits(8);
				}
				if(this.copyLen==0)
					this.method=-1; // done
			}
			if(n==size)
				return n;
		}

		if(this.method==-1) {
			if(this.eof)
				break;

			// read in last block bit

			if(this.ngb(1)!=0)
				this.eof=true;
			this.dumpBits(1);

			// read in block type

			this.method=this.ngb(2);
			this.dumpBits(2);
			this.tl=null;
			this.copyLen=0;
		}

		switch(this.method) {
			case 0: // this.zip_STORED_BLOCK
				i=this.inflateStored(buff,off+n,size-n);
				break;

			case 1: // this.zip_STATIC_TREES
				if(this.tl!=null)
					i=this.inflateCodes(buff,off+n,size-n);
				else
					i=this.inflateFixed(buff,off+n,size-n);
				break;

			case 2: // this.zip_DYN_TREES
				if(this.tl!=null)
					i=this.inflateCodes(buff,off+n,size-n);
				else
					i=this.inflateDynamic(buff,off+n,size-n);
				break;

			default: // error
				i=-1;
				break;
		}

		if(i==-1) {
			if(this.eof)
				return 0;
			return -1;
		}
		n+=i;
	}
	return n;
}


zip.prototype.inflateBin=function(size){
	var i,j=0,last_zip_inflate_pos=-1,u8=new Uint8Array(size);
	while((i=this.inflateInternal(u8,j=0,size))>0&&
	  last_zip_inflate_pos!=this.pos) {
		last_zip_inflate_pos=this.pos;
		j+=i;
	}
	return u8;
}

var LZMA = LZMA || {};
LZMA.decompress = function(properties, inStream, outStream, outSize)
{
  var z=new zip(inStream.data,inStream.offset);
  var buffer=z.inflateBin(outSize);
  inStream.offset+=(z.pos+4);
  //var data= new DataView(buffer);
  for(var i=0;i<outSize;i++)
	outStream.writeByte(buffer[i]);

}




















































function $g ( id ) {
    return document.getElementById( id )
}

function $c ( tag ) {
    return document.createElement( tag );
}

// extend object (supports deep)
function extend ( obj ) {
    Array.prototype.slice.call( arguments, 1 ).forEach( function ( source ) {

        if ( source ) {
            for ( var prop in source ) {
                if ( source[ prop ] && source[ prop ].constructor === Object ) {
                    if ( !obj[ prop ] || obj[ prop ].constructor === Object ) {
                        obj[ prop ] = obj[ prop ] || {};
                        extend( obj[ prop ], source[ prop ] );
                    } else {
                        obj[ prop ] = source[ prop ];
                    }
                } else {
                    obj[ prop ] = source[ prop ];
                }
            }

            if ( typeof source !== 'object' )
                obj = source;
        }


    } );
    return obj;
}

// Cubic easing in/out function
// http://gsgd.co.uk/sandbox/jquery/easing/
// b: beginning value, c: change (delta), d: duration

function easeInSine(t,b,c,d){return-c*Math.cos(t/d*(Math.PI/2))+c+b;}
function easeOutSine(t,b,c,d){return c*Math.sin(t/d*(Math.PI/2))+b;}
function easeInOutSine(t,b,c,d){return-c/2*(Math.cos(Math.PI*t/d)-1)+b;}

function easeInCirc(t,b,c,d){return-c*(Math.sqrt(1-(t/=d)*t)-1)+b;}
function easeOutCirc(t,b,c,d){return c*Math.sqrt(1-(t=t/d-1)*t)+b;}
function easeInOutCirc(t,b,c,d){if((t/=d/2)<1)return-c/2*(Math.sqrt(1-t*t)-1)+b;return c/2*(Math.sqrt(1-(t-=2)*t)+1)+b;}

function easeInBack(t,b,c,d,s){var s=1.70158;return c*(t/=d)*t*((s+1)*t-s)+b;}
function easeOutBack(t,b,c,d,s){var s=0.3;return c*((t=t/d-1)*t*((s+1)*t+s)+1)+b;}
function easeInOutBack(t,b,c,d,s){var s=0.6;if((t/=d/2)<1)return c/2*(t*t*(((s*=(1.2))+1)*t-s))+b;return c/2*((t-=2)*t*(((s*=(1.2))+1)*t+s)+2)+b;}

function easeInQuad(t,b,c,d){return c*(t/=d)*t+b;}
function easeOutQuad(t,b,c,d){return-c*(t/=d)*(t-2)+b;}
function easeInOutQuad(t,b,c,d){if((t/=d/2)<1)return c/2*t*t+b;return-c/2*((--t)*(t-2)-1)+b;}

function easeInCubic(t,b,c,d){return c*(t/=d)*t*t+b;}
function easeOutCubic(t,b,c,d){return c*((t=t/d-1)*t*t+1)+b;}
function easeInOutCubic(t,b,c,d){if((t/=d/2)<1)return c/2*t*t*t+b;return c/2*((t-=2)*t*t+2)+b;}

function easeInQuart(t,b,c,d){return c*(t/=d)*t*t*t+b;}
function easeOutQuart(t,b,c,d){return-c*((t=t/d-1)*t*t*t-1)+b;}
function easeInOutQuart(t,b,c,d){if((t/=d/2)<1)return c/2*t*t*t*t+b;return-c/2*((t-=2)*t*t*t-2)+b;}

function easeInQuint(t,b,c,d){return c*(t/=d)*t*t*t*t+b;}
function easeOutQuint(t,b,c,d){return c*((t=t/d-1)*t*t*t*t+1)+b;}
function easeInOutQuint(t,b,c,d){if((t/=d/2)<1)return c/2*t*t*t*t*t+b;return c/2*((t-=2)*t*t*t*t+2)+b;}

function easeInExpo(t,b,c,d){return(t==0)?b:c*Math.pow(2,10*(t/d-1))+b;}
function easeOutExpo(t,b,c,d){return(t==d)?b+c:c*(-Math.pow(2,-10*t/d)+1)+b;}
function easeInOutExpo(t,b,c,d){if(t==0)return b;if(t==d)return b+c;if((t/=d/2)<1)return c/2*Math.pow(2,10*(t-1))+b;return c/2*(-Math.pow(2,-10* --t)+2)+b;}

function easeInElastic(t,b,c,d){var s=1.70158;var p=0;var a=c;if(t==0)return b;if((t/=d)==1)return b+c;if(!p)p=d*.3;if(a<Math.abs(c)){a=c;var s=p/4;}
else var s=p/(2*Math.PI)*Math.asin(c/a);return-(a*Math.pow(2,10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p))+b;}
function easeOutElastic(t,b,c,d){var s=1.70158;var p=0;var a=c;if(t==0)return b;if((t/=d)==1)return b+c;if(!p)p=d*.3;if(a<Math.abs(c)){a=c;var s=p/4;}
else var s=p/(2*Math.PI)*Math.asin(c/a);return a*Math.pow(2,-10*t)*Math.sin((t*d-s)*(2*Math.PI)/p)+c+b;}
function easeInOutElastic(t,b,c,d){var s=1.0;var p=0;var a=c;if(t==0)return b;if((t/=d/2)==2)return b+c;if(!p)p=d*(.3*1.5);if(a<Math.abs(c)){a=c;var s=p/4;}
else var s=p/(2*Math.PI)*Math.asin(c/a);if(t<1)return-.5*(a*Math.pow(2,10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p))+b;return a*Math.pow(2,-10*(t-=1))*Math.sin((t*d-s)*(2*Math.PI)/p)*.5+c+b;}

function easeInBounce(t,b,c,d){return c-easeOutBounce(d-t,0,c,d)+b;}
function easeOutBounce(t,b,c,d){if((t/=d)<(1/2.75)){return c*(7.5625*t*t)+b;}else if(t<(2/2.75)){return c*(7.5625*(t-=(1.5/2.75))*t+.75)+b;}else if(t<(2.5/2.75)){return c*(7.5625*(t-=(2.25/2.75))*t+.9375)+b;}else{return c*(7.5625*(t-=(2.625/2.75))*t+.984375)+b;}}
function easeInOutBounce(t,b,c,d){if(t<d/2)return easeInBounce(t*2,0,c,d)*.5+b;return easeOutBounce(t*2-d,0,c,d)*.5+c*.5+b;}


function contains ( arr, val ) {
    return arr.indexOf( val ) !== -1;
}

// check if object contains any properties
function any ( obj ) {
    return Object.keys( obj ).length > 0;
}

// select first property value of object
function first ( obj ) {
    var key = Object.keys( obj )[ 0 ];
    return key ? obj[ key ] : null;
}

function round ( number, size ) {
    return Math.ceil( number * size ) / size;
}

function rounVector ( v, size ) {
    return new THREE.Vector3( round( v.x, size ), round( v.y, size ), round( v.z, size ) );
}

function getCurve ( key ) {
    if( key === null) return key;
    return window[key];
}

function getDiffArgument ( argument, object ) {

    if ( argument.indexOf( '.' ) > -1 ) {
        var array = argument.split( '.' );

        if ( array.length == 2 ) {
            return object[ array[ 0 ] ][ array[ 1 ] ];
        } else if ( array.length == 3 ) {
            return object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ];
        } else if ( array.length == 4 ) {
            return object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ];
        } else if ( array.length == 5 ) {
            return object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ][ array[ 4 ] ];
        }
    }

    return object[ argument ];
}


function orientation ( container ) {


    if ( window.innerHeight > window.innerWidth ) {
        if ( !window.rotation || window.rotation == 0 ) {
            rotate( 90 );
        }
    } else {
        if ( window.rotation == 90 ) {
            rotate( 0 );
        }
    }


    function rotate ( degs ) {

        var iedegs = degs / 90;
        if ( iedegs < 0 ) iedegs += 4;
        var transform = 'rotate(' + degs + 'deg)';
        var iefilter = 'progid:DXImageTransform.Microsoft.BasicImage(rotation=' + iedegs + ')';
        var styles = [ 'transform: ' + transform,
            '-webkit-transform: ' + transform,
            '-moz-transform: ' + transform,
            '-o-transform: ' + transform,
            'filter: ' + iefilter,
            '-ms-filter: ' + iefilter ].join( ";" );
        document.body.setAttribute( "style", styles );
        window.rotation = degs;

    }


}
















































/**
 * Created by Andrei Nadchuk on 16.06.16.
 * email: navikom11@mail.ru
 */
THREE.OrbitControls.prototype.focus = function ( object, callback, callbackEnd ) {

    var scope = this;

    var centerStart = scope.target.clone();
    var positionStart = scope.object.position.clone();
    var startFov = scope.object.fov;
    var startQuaternion = scope.object.quaternion;


    var arguments = {};

    if( object.position){
        arguments.position = { obj : positionStart, end : object.position };
    }

    if( object.target ){
        arguments.center = { obj : centerStart, end : object.target };
    }

    if( object.fov ){
        arguments.fov = { obj : startFov, end : object.fov };
    }

    if( object.quaternion ){
        arguments.quaternion = { obj : startQuaternion, end : object.quaternion };
    }


    this.enableRotate = false;
    this.enablePan = false;

    if( object.easing == null){

        callback( 'focus', arguments, undefined, function () {
            scope.enableRotate = true;
            scope.enablePan = true;

            callbackEnd();

            setArgs( object.quaternion,  object.position, object.fov, object.target );
        } );

    } else {
        callback( 'focus', arguments, animate, function () {
            scope.enableRotate = true;
            scope.enablePan = true;

            if(object.fov && scope.object.fov != object.fov){
                scope.object.fov = object.fov;
                scope.object.updateProjectionMatrix();
            }
            callbackEnd();
        } );
    }


    function animate ( args ) {

        var currentCenter = args.center ? args.center.obj : undefined;
        var currentPosition = args.position ? args.position.obj : undefined;
        var currentFov = args.fov ? args.fov.obj : undefined;
        var currentQuaternion = args.quaternion ? args.quaternion.obj : undefined;

        setArgs( currentQuaternion, currentPosition, currentFov, currentCenter );

    }

    function setArgs( currentQuaternion, currentPosition, currentFov, currentCenter ) {
        if(currentQuaternion){
            scope.object.quaternion = new THREE.Quaternion( currentQuaternion.x, currentQuaternion.y, currentQuaternion.z, currentQuaternion.w );
        }

        if( currentPosition )
            scope.object.position.copy( new THREE.Vector3( currentPosition.x, currentPosition.y, currentPosition.z ) );

        if( currentFov ) {
            scope.object.fov = currentFov;
            scope.object.updateProjectionMatrix();
        }


        if( currentCenter) {
            scope.target = new THREE.Vector3( currentCenter.x, currentCenter.y, currentCenter.z);
            scope.update();
        }
    }


};

/**
 *
 * @param object end params for controls animation
 * @param callback
 * @param callbackEnd
 */
THREE.OrbitControls.prototype.focus2 = function ( object, callback, callbackEnd ) {

    var scope = this;

    var arguments = {};

    if ( object.position ) {
        arguments.position = { obj : object.position, end : object.position };
    }

    if ( object.quaternion ) {
        arguments.quaternion = { obj : object.quaternion, end : object.quaternion };
    }


    callback( 'focus', arguments, animate, function () {

        callbackEnd();
    } );

    function animate ( args ) {

        var currentQuaternion = args.quaternion ? args.quaternion.start : undefined;
        var currentPosition = args.position ? args.position.start : undefined;

        if ( currentPosition )
            scope.object.position.copy( new THREE.Vector3( currentPosition.x, currentPosition.y, currentPosition.z ) );

        if ( currentQuaternion ){
            var quaternion = new THREE.Quaternion( (currentQuaternion.x *1), (currentQuaternion.y * 1), (currentQuaternion.z *1), (currentQuaternion.w *1) );
            var vector = scope.object.position.clone();
            var t_vector = object.t_position;
            scope.target.copy( t_vector );
            scope.update();
            console.log( "camera", scope.object.position, "t_vect", t_vector );
            //console.log( "q", quaternion, "t_vect", t_vect );
        }


    }


};

/**
 *
 * @param viewer
 * @param style relative by viewer container
 * @returns {THREE.InterfaceFrame}
 * @constructor
 *
 */
THREE.InterfaceFrame = function ( viewer, userData ) {

    var scope = this, coeff = 0.11, domElement;
    var style = userData.style;

    if ( userData.domElementId ) {
        domElement = $g( userData.domElementId );
    }

    init();

    function init () {
        var camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
        camera.position.z = 45 / getStep();
        camera.position.y = 0;
        camera.position.x = 0;
        camera.target = new THREE.Vector3();

        var scene = new THREE.Scene();
        scene.add( camera );

        var light = new THREE.AmbientLight( 0xffffff );
        scene.add( light );


        var renderer = new THREE.WebGLRenderer( { antialias : true, alpha : true } );

        renderer.setPixelRatio( window.devicePixelRatio );

        var size = getSize();

        renderer.setSize( size.width, size.height );
//        renderer.setClearColor( 0xF0F0F0 );
        renderer.gammaInput = true;
        renderer.gammaOutput = true;

        var container;

        if ( domElement ) {
            container = domElement;
        } else {

            container = $c( 'div' );
            document.body.insertBefore( container, document.getElementById( 'toggle' ) );
        }


        container.appendChild( renderer.domElement );

        scope.container = container;
        scope.camera = camera;
        scope.scene = scene;
        scope.renderer = renderer;

        //

        window.addEventListener( 'resize', onWindowResize, false );


    }

    function onWindowResize () {

        if ( scope.renderer == null ) return;

        if ( domElement ) {
            resizeContainer();
        } else {
            setRelativeViewerContainer();
        }


    }

    function getStep () {

        var c1 = coeff / (45 / getSize().width);
        return (1 - c1) / 2 * c1 + c1;
    }

    function getSize () {

        return {
            width : domElement ? domElement.offsetWidth : (style.width || viewer.container.offsetWidth / 3),
            height : domElement ? domElement.offsetHeight : (style.height || viewer.container.offsetHeight / 3)
        }
    }

    function resizeContainer () {

        var size = getSize()
        scope.camera.aspect = size.width / size.height;
        scope.camera.updateProjectionMatrix();


        scope.camera.position.z = 45 / getStep();

        scope.renderer.setSize( size.width, size.height );

    }

    function setRelativeViewerContainer () {

        var width = style.width || viewer.container.offsetWidth / 3;
        var height = style.height || viewer.container.offsetHeight / 3;
        scope.camera.aspect = width / height;
        scope.camera.updateProjectionMatrix();


        scope.camera.position.z = 45 / getStep();

        scope.renderer.setSize( width, height );

        var offsetTop = viewer.container.offsetTop;
        var offsetLeft = viewer.container.offsetLeft;
        var offsetWidth = viewer.container.offsetWidth;
        var offsetHeight = viewer.container.offsetHeight;

        var containerTopInPercent = offsetTop / window.innerHeight * 100;
        var containerLeftInPercent = offsetLeft / window.innerWidth * 100;
        var containerBottomInPercent = (window.innerHeight - (offsetTop + offsetHeight)) / window.innerHeight * 100;
        var containerRightInPercent = (window.innerWidth - (offsetLeft + offsetWidth)) / window.innerWidth * 100;

        for ( var key in style ) {
            scope.container.style[ key ] = style[ key ];
        }

        scope.container.style.top = style.top ? (style.top + containerTopInPercent) + '%' : '';
        scope.container.style.left = style.left ? (style.left + containerLeftInPercent) + '%' : '';
        scope.container.style.right = style.right ? (style.right + containerRightInPercent) + '%' : '';
        scope.container.style.bottom = style.bottom ? (style.bottom + containerBottomInPercent) + '%' : '';
    }

    onWindowResize();

    return this;

};

/**
 * module for 3d objects animations
 * @param viewer
 * @param callback
 * @constructor
 */
THREE.AnimationsHelper = function ( viewer, callback ) {

    // main scene
    var container = viewer.container;
    var mainScene = viewer.scene;
    var mainCamera = viewer.camera;
    var controls = viewer.orbit_controls;
    var mainObjects = [];
    var hoverObjects = [];
    var objectsLookAtCamera = [];
    var eventGroups = {};

    this.dispose = function () {

        var interfaces = viewer.interfaces;
        var listeners = [ 'click', 'touchstart', 'mousemove' ];

        for ( var i = 0, j = interfaces.length; i < j; i++ ) {

            var frame = interfaces[ i ];

            listeners.map( function ( el ) {
                removeAllListeners( frame.container, el );
            } );

        }

        listeners.map( function ( el ) {
            removeAllListeners( container, el );
        } );

        removeAllListeners( controls, 'change' );


    };

    var _eventHandlers = {};

    function addListener ( node, event, handler, capture ) {
        if ( !(node in _eventHandlers) ) {
            _eventHandlers[ node ] = {};
        }
        if ( !(event in _eventHandlers[ node ]) ) {
            _eventHandlers[ node ][ event ] = [];
        }

        _eventHandlers[ node ][ event ].push( [ handler, capture ] );
        node.addEventListener( event, handler, capture );
    }

    function removeAllListeners ( node, event ) {
        if ( node in _eventHandlers ) {
            var handlers = _eventHandlers[ node ];
            if ( event in handlers ) {
                var eventHandlers = handlers[ event ];
                for ( var i = eventHandlers.length; i--; ) {
                    var handler = eventHandlers[ i ];
                    node.removeEventListener( event, handler[ 0 ], handler[ 1 ] );
                }
            }
        }
    }

    traverse( mainScene, mainObjects );

    // interfaces

    var interfaces = viewer.interfaces;

    for ( var i = 0, j = interfaces.length; i < j; i++ ) {

        var frame = interfaces[ i ];
        frame.objects = [];
        traverse( frame.scene, frame.objects );

        addListener( frame.container, 'click', onClick.bind( this, frame ), false );
        addListener( frame.container, 'touchstart', onTouchEnd.bind( this, frame ), false );
        addListener( frame.container, 'mousemove', onMouseMove.bind( this, frame ), false );

        //frame.container.addEventListener( 'click', onClick.bind( this, frame ), false );
        //frame.container.addEventListener( 'touchstart', onTouchEnd.bind( this, frame ), false );
        //frame.container.addEventListener( 'mousemove', onMouseMove.bind( this, frame ), false );


    }


    function traverse ( scene, array ) {

        (function addObjects ( children, pad ) {

            for ( var i = 0, l = children.length; i < l; i++ ) {

                var object = children[ i ];

                if ( object.children.length > 0 )
                    addObjects( object.children );

                if ( object.userData.animations ) {

                    checkAvailabilityGroups( object, scene );

                    array.push( object );
                    object.objectsLink = array;
                }

                if ( object.userData.lookat_camera ) {
                    object.lookAtCamera = true;
                    objectsLookAtCamera.push( object );
                    object.lookAt( mainCamera.position );
                }

                if ( object.userData.autorotation ) {
                    viewer.autorotations[ object.uuid ] = object;
                }


            }

        })( scene.children );

    }


    // object picking

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    // events

    function getIntersects ( point, objects, camera ) {

        mouse.set( ( point.x * 2 ) - 1, -( point.y * 2 ) + 1 );

        raycaster.setFromCamera( mouse, camera );

        return raycaster.intersectObjects( objects );

    }

    var onUpPosition = new THREE.Vector2();
    var onHoverPosition = new THREE.Vector2();

    function getMousePosition ( dom, x, y ) {

        var rect = dom.getBoundingClientRect();
        return [ ( x - rect.left ) / rect.width, ( y - rect.top ) / rect.height ];

    }

    function handleClick ( objects, camera ) {

        var intersects = getIntersects( onUpPosition, objects, camera );

        if ( intersects.length > 0 ) {

            var object = intersects[ 0 ].object;

            if ( object.userData.animations.click && !isDisabled( object ) ) {
                applyAnimations( object, 'click', 0 );

                checkReverse( object );

            }
            if ( object.userData.animations.singleClick && !isDisabled( object ) ) {
                applySingleClickAnimation( object, 'single_click', 0 );

            }

        }


    }

    function handleHover ( objects, camera ) {


        var intersects = getIntersects( onHoverPosition, objects, camera );

        if ( intersects.length > 0 ) {

            var object = intersects[ 0 ].object;

            if ( object.userData.animations.hover && !isDisabled( object ) ) {
                applyAnimations( object, 'hover', 0 );
                applyBackHoverAnimation( object );
            }


        } else {

            applyBackHoverAnimation();
        }

    }


    function onControlsChanged () {

        if ( objectsLookAtCamera.length == 0 ) return;

        for ( var i = 0; i < objectsLookAtCamera.length; i++ ) {

            if ( objectsLookAtCamera[ i ].lookAtCamera )
                objectsLookAtCamera[ i ].lookAt( mainCamera.position );

        }

    }


    // events

    function onClick ( frame, event ) {

        var array = getMousePosition( frame.container, event.clientX, event.clientY );
        onUpPosition.fromArray( array );

        handleClick( frame.objects, frame.camera );


    }


    function onTouchEnd ( frame, event ) {

        var touch = event.changedTouches[ 0 ];

        var array = getMousePosition( frame.container, touch.clientX, touch.clientY );
        onUpPosition.fromArray( array );

        handleClick( frame.objects, frame.camera );

        //document.removeEventListener( 'touchend', onFrameTouchEnd.bind(this, frame), false );

    }

    function onMouseMove ( frame, event ) {

        var array = getMousePosition( frame.container, event.clientX, event.clientY );
        onHoverPosition.fromArray( array );
        handleHover( frame.objects, frame.camera );
    }

    var frame = { container : container, objects : mainObjects, camera : mainCamera };

    addListener( container, 'click', onClick.bind( this, frame ), false );
    addListener( container, 'touchstart', onTouchEnd.bind( this, frame ), false );
    addListener( container, 'mousemove', onMouseMove.bind( this, frame ), false );
    addListener( controls, 'change', onControlsChanged, false );

    //container.addEventListener( 'click', onClick.bind( this, frame ), false );
    //container.addEventListener( 'touchstart', onTouchEnd.bind( this, frame ), false );
    //container.addEventListener( 'mousemove', onMouseMove.bind( this, frame ), false );
    //controls.addEventListener( 'change', onControlsChanged, false );


    function checkAvailabilityGroups ( object, scene ) {

        var animations = object.userData.animations.click;

        if ( animations ) {

            for ( var i = 0; i < animations.length; i++ ) {

                if ( animations[ i ].event_id ) {

                    if ( !eventGroups[ animations[ i ].event_id ] ) {
                        eventGroups[ animations[ i ].event_id ] = [];
                    }

                    eventGroups[ animations[ i ].event_id ].push( scene.getObjectByProperty( 'name', animations[ i ].object, true ) );

                }

            }

        }

    }

    function checkReverse ( object ) {

        var reverse = object.userData.animations.reverse;

        if ( !reverse )
            object.userData.animations.reverse = true;
        else
            object.userData.animations.reverse = !object.userData.animations.reverse;

    }

    /*
     if click event array has some object with setting : sequence = true
     following object will be call by sequence
     example
     "click" :{
     {
     "object": "obj1",
     ...settings..
     },
     {
     "object": "obj2",
     ...settings..
     "sequence" : true
     },
     {
     "object": "obj3",
     ...settings..
     },
     {
     "object": "obj4",
     ...settings..
     },
     }
     obj1 and obj2 will be call at the same time
     obj3 and obj4 will be call at the same when obj2 has finished the animation (by duration)
     if for obj3 add setting: sequence = true obj4 will be call when that one has finished the animation (by duration)

     */

    function applyAnimations ( object, event, index ) {


        var animations = object.userData.animations[ event ];

        for ( var i = index; i < animations.length; i++ ) {

            var objs = getObj( animations[ i ].object );
            var sequenceBreak = false;

            objs.map( function ( obj ) {

                if ( !obj.userData[ event ] )
                    obj.userData[ event ] = {};
                obj.userData[ event ][ object.uuid + i ] = animations[ i ];


                switch ( event ) {
                    case 'click':
                        if ( animations[ i ].event === 'custom' ) {
                            obj.userData.animations.custom = animations[ i ];
                            applyCustomAnimation( obj );
                        } else if ( animations[ i ].event === 'autorotation' ) {
                            applyAutoRotation( obj );
                        } else if ( animations[ i ].event === 'camera_autorotate' ) {
                            applyControlsAutoRotation( animations[ i ].arguments );
                        } else if ( animations[ i ].event === 'scene_event' ) {
                            applySceneEvent( animations[ i ].arguments );
                        } else if ( animations[ i ].event === 'cycle_event' ) {
                            applyCycleEvent( obj, object.uuid + i );
                        } else if ( animations[ i ].event === 'single_change' ) {
                            applySingleChange( obj, object, i );
                        } else if ( animations[ i ].event === 'material_change' ) {
                            applyMaterialChange( obj, object.uuid + i );
						} else if ( animations[ i ].event === 'hide_object' ) {
                            applyHideChange( obj, object.uuid + i );
                        } else if ( animations[ i ].event === 'show_object' ) {
                            applyShowChange( obj, object.uuid + i );
                        } else if ( animations[ i ].event === 'toggle' ) {
                            applyToggle( obj, object.uuid + i );
                        } else if ( animations[ i ].event === 'reset' ) {
                            applyReset( obj, object.uuid + i );
                        } else
                            applyClickAnimation( obj, object.uuid + i );

                        break;
                    case 'hover':
                        applyHoverAnimation( obj, object.uuid + i );
                        break;
                }

                if ( animations[ i ].sequence ) {

                    obj.userData[ event ][ object.uuid + i ].sequence = {
                        callback : applyAnimations,
                        args : [ object, event, ++i ]
                    };
                    sequenceBreak = true;
                }

            } );


            if ( sequenceBreak )
                break;

        }

    }

    function getObj ( name ) {

        var objects = [];
        var objNames = name.split( ',' );

        objNames.map( function ( objName ) {

            objName = objName.trim();

            var obj = mainScene.getObjectByProperty( 'name', objName, true );

            if ( !obj ) {

                for ( var i = 0, j = interfaces.length; i < j; i++ ) {
                    obj = interfaces[ i ].scene.getObjectByProperty( 'name', objName, true );
                    if ( obj != undefined )
                        break;
                }

            }
            objects.push( obj );

        } )

        return objects;
    }

    function isDisabled ( object ) {

        return object.userData.animations.disabled;


    }

    function applyCustomAnimation ( object ) {

        var group = eventGroups[ object.name ];
        var action = object.userData.animations.custom.event_action;

        for ( var i = 0; i < group.length; i++ ) {

            var animation = group[ i ].userData.click;


            if ( !animation ) continue;

            for ( var key in animation ) {

                var current = animation[ key ];
                switch ( action ) {
                    case 'on':

                        if ( !current.active && !current.clickOn )
                            applyClickAnimation( group[ i ], key );

                        break;
                    case 'off':
                        if ( !current.active && current.clickOn )
                            applyClickAnimation( group[ i ], key );

                        break;

                    case 'other':
                        break;
                }

            }

        }

    }

    function applyAutoRotation ( object ) {

        object.userData.autorotation.enabled = !object.userData.autorotation.enabled;

    }

    function applyControlsAutoRotation ( options ) {

        viewer.cameraAnimationHelper.applyAutorotate( options );
    }

    function applyCameraAnimations ( viewName ) {
        viewer.cameraAnimationHelper.applyAnimations( viewName );
    }

    function applySceneEvent ( options ) {

        for ( var key in options ) {
            switch ( key ) {
                case 'full_screen':

                    if ( options.full_screen.switch )
                        THREEx.FullScreen.switch();

                    break;
            }
        }

    }


    function applyCycleEvent ( object, uuid ) {

        if ( object.userData.click[ uuid ].active ) return;

        // for start make simple click animation by arguments
        applyClickAnimation( object, uuid );

        var enabled = object.userData.click[ uuid ].cycle.enabled;

        if ( enabled ) {

            delete object.userData.cycle[ uuid ];

        } else {

            var steps = object.userData.click[ uuid ].cycle.steps;
            var interval = object.userData.click[ uuid ].cycle.interval;
            var duration = object.userData.click[ uuid ].cycle.duration;
            var easing = object.userData.click[ uuid ].cycle.easing;

            if ( !object.userData.cycle ) object.userData.cycle = {};

            object.userData.cycle[ uuid ] = [];

            for ( var i = 0, j = steps.length; i < j; i++ ) {

                var uuidStep = THREE.Math.generateUUID();
                object.userData.cycle[ uuid ].push( {
                    uuid : uuidStep,
                    arguments : steps[ i ],
                    delay : interval,
                    duration : duration,
                    easing : easing
                } );

            }

            makeStep( object, uuid, 0 );

        }


        object.userData.click[ uuid ].cycle.enabled = !enabled;
    }

    function makeStep ( object, uuid, i ) {

        if ( !object.userData.cycle[ uuid ] ) return;

        var step = object.userData.cycle[ uuid ][ i ];

        var index = i == object.userData.cycle[ uuid ].length - 1 ? 0 : i + 1;


        step.sequence = { callback : makeStep, args : [ object, uuid, index ] };
        object.userData.click[ step.uuid ] = step;

        applyClickAnimation( object, step.uuid, function () {
            step.sequence = undefined;
        } );

    }


    function applySingleChange ( object, parent, index ) {

        applyClickAnimation( object, parent.uuid + index );
        var toggle = object.userData.click[ parent.uuid + index ].toggle;

        var toggleObjects = getObj( toggle );

        toggleObjects.map( function ( toggleObject ) {

            if ( !toggleObject.userData.animations.click ) {
                var arguments = {};

                for ( var key in object.userData.click[ parent.uuid + index ].backAnimation ) {
                    arguments[ key ] = object.userData.click[ parent.uuid + index ].backAnimation[ key ].end;
                }

                toggleObject.userData.animations.click = [ {
                    "object" : object.userData.click[ parent.uuid + index ].object,
                    "event" : "single_change",
                    "toggle" : parent.name,
                    "arguments" : arguments,
                    "delay" : object.userData.click[ parent.uuid + index ].delay,
                    "duration" : object.userData.click[ parent.uuid + index ].duration,
                    "easing" : object.userData.click[ parent.uuid + index ].easing
                } ];

                toggleObject.userData.animations.hover[ 0 ].disabled = false;
            }

            parent.objectsLink.splice( parent.objectsLink.indexOf( parent ), 1 );

            if ( toggleObject.objectsLink.indexOf( toggleObject ) == -1 )
                toggleObject.objectsLink.push( toggleObject );

        } )


    }

    function applyMaterialChange ( object, uuid ) {

        var key = object.userData.click[ uuid ].arguments.material;
        viewer.setMaterial( key, object );

    }

	/// a bit shit
    function applyHideChange ( object, uuid ) {

        var key = object.userData.click[ uuid ];
		object.visible = false;
    }

    function applyShowChange ( object, uuid ) {

        var key = object.userData.click[ uuid ];
		object.visible = true;
    }

    function applyToggle ( object, uuid ) {

        object.userData.animations.disabled = object.userData.click[ uuid ].disabled;
    }

    function applyReset ( object, uuid ) {

        object.userData.click[ uuid ].delay = 0;
        object.userData.click[ uuid ].duration = 0;
        object.userData.click[ uuid ].easing = null;

        applyClickAnimation( object, uuid );
    }


    function applyClickAnimation ( object, uuid, cycleCallback ) {

        if ( object.userData.click[ uuid ].active && cycleCallback === undefined ) return;

        var arguments = object.userData.click[ uuid ].arguments;
        var delay = object.userData.click[ uuid ].delay;
        var duration = object.userData.click[ uuid ].duration;
        var easing = getCurve( object.userData.click[ uuid ].easing );
        var visible = object.userData.click[ uuid ].visible;
        var lookAtCamera = object.userData.click[ uuid ].lookat_camera;
        var eventCamera = object.userData.click[ uuid ].event_cam;
        var easingCamera = object.userData.click[ uuid ].easing_cam;
        var durationCamera = object.userData.click[ uuid ].duration_cam;
        var toggle = object.userData.click[ uuid ].toggle || object.userData.click[ uuid ].oneWay;
        var eventCameraAnimations = object.userData.click[ uuid ].event_cam_animations;


        if ( object.userData.click[ uuid ].clickOn && cycleCallback === undefined ) {
            applyAnimation( 'clickOff' + object.uuid + uuid, object, object.userData.click[ uuid ].backAnimation, duration, delay, easing, function () {

                object.userData.click[ uuid ].active = false;
                object.userData.click[ uuid ].clickOn = false;

                if ( visible != undefined )
                    object.visible = !visible;

                if ( lookAtCamera != undefined )
                    object.lookAtCamera = !lookAtCamera;

                if ( object.userData.click[ uuid ].sequence ) {

                    var args = object.userData.click[ uuid ].sequence.args;
                    object.userData.click[ uuid ].sequence.callback( args[ 0 ], args[ 1 ], args[ 2 ] );

                }

            } );


        } else {

            var args = getArguments( arguments, object );
            object.userData.click[ uuid ].backAnimation = args.back;

            catchInHover( object, args.forward );

            applyAnimation( 'clickOn' + object.uuid + uuid, object, args.forward, duration, delay, easing, function () {

                object.userData.click[ uuid ].active = false;
                object.userData.click[ uuid ].clickOn = true;

                if ( visible != undefined )
                    object.visible = visible;

                if ( lookAtCamera != undefined ) {

                    object.lookAtCamera = lookAtCamera;
                    object.lookAt( mainCamera.position );
                    if ( objectsLookAtCamera.indexOf( object ) == -1 )
                        objectsLookAtCamera.push( object )

                }
                if ( object.userData.click[ uuid ].sequence ) {

                    var args = object.userData.click[ uuid ].sequence.args;
                    object.userData.click[ uuid ].sequence.callback( args[ 0 ], args[ 1 ], args[ 2 ] );

                }

                if ( cycleCallback ) cycleCallback();

                if ( toggle ) {
                    object.userData.click[ uuid ].clickOn = false;
                    delete object.userData.click[ uuid ];
                }


            } );
        }

        if ( eventCamera ) {

            viewer.switchCamera( eventCamera, durationCamera, easingCamera );

        }

        if ( eventCameraAnimations ) {
            applyCameraAnimations( eventCameraAnimations );
        }


        object.userData.click[ uuid ].active = true;
    }

    function catchInHover ( object, args ) {

        if ( object.userData.hover ) {

            for ( var uuid in object.userData.hover ) {
                if ( object.userData.hover[ uuid ].afterAnimation ) {
                    if ( object.name === 'sprite_obj13' )
                        checkAndApplyArgs( object.userData.hover[ uuid ] );

                }

            }

        }

        function checkAndApplyArgs ( arguments ) {

            for ( var key in args ) {

                if ( arguments.backAnimation[ key ] )
                    arguments.backAnimation[ key ].obj = arguments.backAnimation[ key ].end = extend( {}, args[ key ].end );

            }

        }

    }

    function applySingleClickAnimation ( object, event, index ) {

        var animations = object.userData.animations.singleClick;

        for ( var i = 0, j = animations.length; i < j; i++ ) {

            animations[ i ].oneWay = true;

        }

        object.userData.animations.click = animations;


        applyAnimations( object, 'click', 0 );

    }


    function applyHoverAnimation ( object, uuid ) {

        if ( object.userData.hover[ uuid ].disabled || object.userData.hover[ uuid ].active || object.userData.hover[ uuid ].afterAnimation ) return;

        var arguments = object.userData.hover[ uuid ].arguments;
        var delay = object.userData.hover[ uuid ].delay;
        var duration = object.userData.hover[ uuid ].duration;
        var easing = getCurve( object.userData.hover[ uuid ].easing );
        var visible = object.userData.hover[ uuid ].visible;

        var args = getArguments( arguments, object );

        object.userData.hover[ uuid ].backAnimation = args.back;


        applyAnimation( 'hover' + object.uuid, object, args.forward, duration, delay, easing, function () {

            object.userData.hover[ uuid ].active = false;
            object.userData.hover[ uuid ].afterAnimation = true;

            if ( visible != undefined )
                object.visible = visible;

        } );

        object.userData.hover[ uuid ].active = true;

        hoverObjects.push( object );

    }

    function getArguments ( arguments, object ) {

        var backArgs = {};

        var forwardArgs = {};

        for ( var argument in arguments ) {

            var objectArgument = getDiffArgument( argument, object );


            if ( arguments[ argument ] instanceof Object ) {

                var obj = {};
                var end = {};

                for ( var key in arguments[ argument ] ) {
                    if ( key === 'x' || key === 'y' || key === 'z' || key === 'r' || key === 'g' || key === 'b' ) {

                        obj[ key ] = objectArgument[ key ];
                        end[ key ] = arguments[ argument ][ key ];
                    }


                }

            } else {

                if ( typeof  arguments[ argument ] != 'function' ) {
                    var obj = objectArgument;
                    var end = arguments[ argument ];
                }

            }

            forwardArgs[ argument ] = { obj : obj, end : end };

            backArgs[ argument ] = { obj : end, end : obj };

        }

        return {
            forward : forwardArgs, back : backArgs
        }
    }

    function applyBackHoverAnimation ( hoverObject ) {

        if ( hoverObjects.length == 0 ) return;

        var interval = setInterval( function () {

            for ( var i = 0; i < hoverObjects.length; i++ ) {

                var object = hoverObjects[ i ];

                if ( hoverObject && hoverObject === object ) continue;

                if ( object.userData.hover ) {

                    for ( var uuid in object.userData.hover ) {
                        if ( object.userData.hover[ uuid ].afterAnimation ) {

                            backHoverAnimation( object, uuid );

                            hoverObjects.splice( hoverObjects.indexOf( object ), 1 );
                        }

                    }

                }

            }

            if ( hoverObjects.length == 0 ) clearInterval( interval );

        }, 200 );


        function backHoverAnimation ( object, uuid ) {

            var args = object.userData.hover[ uuid ];
            var visible = object.userData.hover[ uuid ].visible;

            applyAnimation( 'backHover' + object.uuid, object, args.backAnimation, args.duration, args.delay, getCurve( args.easing ), function () {

                object.userData.hover[ uuid ].afterAnimation = false;

                if ( visible != undefined )
                    object.visible = !visible;

            } );

        }

    }

    function applyAnimation ( name, object, args, duration, delay, easing, endCallback ) {

        if ( easing == null ) {
            callback( name, args, duration, delay, easing, undefined, function () {
                endCallback();

                if ( Object.keys( args ).length > 0 ) {
                    setArguments( args, object, 'end' );

                }
            } );
        } else
            callback( name, args, duration, delay, easing, animate, endCallback );

        function animate ( currentArgs ) {

            setArguments( currentArgs, object, 'obj' );

        }


    }

    function setArguments ( arguments, object, keyW ) {

        for ( var arg in arguments ) {

            var objectArgument = getDiffArgument( arg, object );

            if ( arguments[ arg ][ keyW ] instanceof Object ) {

                for ( var key in arguments[ arg ][ keyW ] ) {

                    objectArgument[ key ] = arguments[ arg ][ keyW ][ key ];

                }
            } else {

                setParameter( arg, object, arguments[ arg ][ keyW ] )
            }

        }

    }


    function setParameter ( key, object, value ) {

        var array = key.split( '.' );

        if ( array.length > 1 ) {
            if ( array.length == 2 )
                object[ array[ 0 ] ][ array[ 1 ] ] = value;
            else if ( array.length == 3 )
                object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ] = value;
            else if ( array.length == 4 )
                object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ] = value;
            else if ( array.length == 5 )
                object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ][ array[ 4 ] ] = value;


        } else {
            object[ key ] = value;
        }

    }


};

/**
 * module for camera animations
 * @param viewer
 * @constructor
 */
THREE.CameraAnimationHelper = function ( viewer ) {

    var controls = viewer.orbit_controls;
    var speed = 0.5;
    var animation = { play : false, currentFrame: 0 };
    controls.autoRotateSpeed = speed;
/* html button
    var autoRotation = document.getElementById( 'auto-rotation' );
    autoRotation.addEventListener( 'change', function () {
        if ( this.checked ) {
            controls.autoRotate = true;
        } else {
            controls.autoRotate = false;
            enableDamping();
        }
    } );
*/
    this.applyAnimations = function ( options ) {
        var view = options.view;
        var animations = viewer.cameraAnimations[ view ];
        var action = options.action;
        var fov = undefined;

        animation.endFrame = Infinity;

        animation.timeOut = options.timeOut;

        if ( options.fov && viewer.camera.fov != options.fov ) {
            animation.play = false;
            fov = options.fov;
            action = "play";
        }

        if( options.startFrame ){
            animation.play = false;
            animation.currentFrame = options.startFrame;
            fov = viewer.camera.fov;
            action = "play";
        }

        if( options.playUntilFrame ){
            animation.play = false;
            animation.endFrame = options.playUntilFrame;
            action = "play";
        }

        switch ( action ) {
            case "pause":
                animation.play = false;
                break;
            case "stop":
                animation.play = false;
                animation.currentFrame = 0;
                break;
            case "play":
                if( animation.play ) return;
                animation.play = true;
                setTimeout( function(){
                    switchCamera( animations.tracks, animation.currentFrame, animations.scale, fov);
                }, 10);

            default:


        }


    };

    this.applyOptions = function ( currentView ) {

        if ( currentView.userData ) {

            for ( var key in currentView.userData ) {
                switch ( key ) {
                    case 'autorotation':
                        this.applyAutorotate( currentView.userData.autorotation );
                        break;
                    case 'invert':
                        applyOptions( currentView.userData.invert, 'invert' );
                        break;
                    case 'parameters':
                        applyOptions( currentView.userData.parameters );
                        break;
                    default:
                        break;

                }
            }

        }

    };

    this.applyAutorotate = function ( options ) {

        controls.autoRotateSpeed = speed;

        if ( options.speed ) controls.autoRotateSpeed = options.speed;

        if ( options.switch ) {
            controls.autoRotate = !controls.autoRotate;
            autoRotation.checked = controls.autoRotate;

        } else {
            controls.autoRotate = options.enable;
            autoRotation.checked = options.enable;

        }

        if ( options.delay && options.enable ) {

            controls.autoRotate = false;

            setTimeout( function () {

                controls.autoRotate = true;

            }, options.delay );

        }


        enableDamping()


    }

    function enableDamping () {
        var enableDamping = controls.enableDamping;

        if ( !controls.autoRotate ) {
            controls.enableDamping = false;
            setTimeout( function () {
                controls.enableDamping = enableDamping;
            }, 10 );
        }
    }

    function applyOptions ( options, key ) {

        for ( var option in options ) {
            if ( key ) controls[ key ][ option ] = options[ option ];
            else controls[ option ] = options[ option ];
        }
    }

    function switchCamera ( tracks, index, scale, fov, duration, easing ){

        if( index == 0 || fov){

            animation.play = false;
            var track = tracks[ index++ ];
            var position = track.position;
            var t_position = track.t_position;
            var quaternion = track.quaternion;
            //console.log( "sw_t_position", t_position );

            var arguments = {};

            if ( position ) {
                arguments.position = { x : position[ 0 ] * scale, y : position[ 1 ] * scale, z : position[ 2 ] * scale };
            }

            if ( t_position ) {
                arguments.t_position = { x : t_position[ 0 ] * scale, y : t_position[ 1 ] * scale, z : t_position[ 2 ] * scale };
            }

            if ( quaternion ) {
                arguments.quaternion = {
                    x : quaternion[ 0 ] * scale,
                    y : quaternion[ 1 ] * scale,
                    z : quaternion[ 2 ] * scale,
                    w : quaternion[ 3 ] * scale
                };
            }

            if( fov ){
                arguments.fov = fov;
            }

            viewer.moveCamera ( 'switchCamera_' + index, arguments, duration, 0, easing || 'easeOutSine', function (){
                animation.play = true;
                playAnimations( tracks, index, scale, (+new Date) );
            });

        } else {
            playAnimations( tracks, index, scale, (+new Date) );
        }

    }

    function playAnimations ( tracks, index, scale, time ) {

        animation.currentFrame = index;

        var delay = 0;
        scale = scale || 1;

        if ( index > 0 ) {
            var step = tracks[ index ].t - tracks[ index - 1 ].t;

            var delta = step - ((+new Date) - time);

            if ( delta > 0 )
                delay = delta;
        }

        if(animation.timeOut){
            delay += animation.timeOut;
            animation.timeOut = undefined;
        }

        var track = tracks[ index++ ];
        var position = track.position;
        var t_position = track.t_position;
        var quaternion = track.quaternion;
        //console.log( "pl_t_position", t_position );


        var arguments = {};

        if ( position ) {
            arguments.position = { x : position[ 0 ] * scale, y : position[ 1 ] * scale, z : position[ 2 ] * scale };
        }

        if ( t_position ) {
            arguments.t_position = { x : t_position[ 0 ] * scale, y : t_position[ 1 ] * scale, z : t_position[ 2 ] * scale };
        }

        if ( quaternion ) {
            arguments.quaternion = {
                x : quaternion[ 0 ] * scale,
                y : quaternion[ 1 ] * scale,
                z : quaternion[ 2 ] * scale,
                w : quaternion[ 3 ] * scale
            };
        }

        viewer.animateCamera( 'view_animation_' + index, arguments, 0, delay, function () {

            if(animation.play){

                if(index < animation.endFrame){

                    if ( index < tracks.length ) {
                        playAnimations( tracks, index, scale, (+new Date) );
                    } else {
                        playAnimations( tracks, 0, scale, (+new Date) );
                    }

                } else {

                    animation.play = false;
                }

            }

        } );

    }
};

/**
 * camera animation data loader
 * @param viewer
 * @constructor
 */
THREE.CameraAnimationDataLoad = function ( viewer ) {

    var loader = new THREE.FileLoader();
    loader.load( viewer.options.camera_animations, function ( text ) {

        viewer.cameraAnimations = JSON.parse( text ).animations;

        loadData( 0 );

    } );

    function loadData ( index ) {

        var key = Object.keys( viewer.cameraAnimations )[ index++ ];

        viewer.cameraAnimations[ key ].tracks = [];

        //BEFORE: Not using the static server
        //loader.load( viewer.cameraAnimations[ key ].path, function ( data ) {

        //Using the static server
        var path = viewer.options.scene_assets_url + viewer.cameraAnimations[ key ].path;
        loader.load( path, function ( data ) {

            JSON.parse( data ).space.root.i.map( function ( object ) {

                if ( object.anim ) {
                    var length = 0;

                    if ( object.anim.pos && object.anim.pos.length > 0 ) {
                        length = object.anim.pos.length;
                    }
                    if ( object.anim.t_pos && object.anim.t_pos.length > 0 ) {
                        length = object.anim.t_pos.length;
                    }
                    if ( object.anim.rot && object.anim.rot.length > 0 ) {
                        length = length < object.anim.rot.length ? object.anim.rot.length : length;
                    }

                    for ( var i = 0; i < length; i++ ) {
                        var track = {};
                        if ( object.anim.pos && object.anim.pos[ i ] ) {

                            track.position = object.anim.pos[ i ].v;
                            track.t = object.anim.pos[ i ].t;
                        }
                        if ( object.anim.t_pos && object.anim.t_pos[ i ] ) {

                            track.t_position = object.anim.t_pos[ i ].v;
                            track.t = object.anim.t_pos[ i ].t;
                        }
                        if ( object.anim.rot && object.anim.rot[ i ] ) {

                            track.quaternion = object.anim.rot[ i ].v;
                            track.t = object.anim.rot[ i ].t;
                        }

                        viewer.cameraAnimations[ key ].tracks[ i ] = track;
                    }
                }
            } );

            if ( index < Object.keys( viewer.cameraAnimations ).length )
                loadData( index );

        } );


    }

}





































// Ion viewer modified for d17 (HQ viewer)

function IonVR ( options ) {
    var options = options || {};

    var defaults = {
        stats : false,
        debug : false,
        container : null,
        skybox : false,
		sky : false,
        lightprobe : true,
        lightprobe_tx : '',
        lightprobe_comp : '',
        lightprobeInt : 0.8,
		exposure : 1.5,
        skybox_tx : 'env_tex',
        always_render : false,
        scene : '', // url
        env : '', // url
		scene_assets_url : '',
		woo_tex_url : '',
		woo_3d_url : '',
        geom_buffer : false,
        camera : {
            position : {
                x : 0,
                y : 0,
                z : 100
            },
            fov : 35,
            target : {
                x : 0,
                y : 0,
                z : 0
            }
        },
        g_in : false,
        g_out : false,
		g_f : 2,
        phys_shading : false,
        rotate_left : 1.57, // rotate main group by y axis
        spin : true, // spin on switching frames
        spin_duration : 1000,
        zoom_factor : 10,
        set : null,
        ready : false,
        showStatus : true,
		audio : false,
		audio_track: null
    };

	// data values
    this.data = {
        param: {
			wind: {
				direction: 350,
				speed: 30
			},
			gust: {
				direction: 270,
				speed: 25
			},
			sun: {
				distance: 400,
				inclination: 0.5,
				azimuth: 0.55,
				intensity: 1.5
			},
			sky: {
				turbidity: 10,
				rayleigh: 2,
				luminance: 1,
				mieCoefficient: 0.005,
				mieDirectionalG: 0.8,
				res: 2048
			},
			live_data: {
				current: {
					cloud: 0,
					feelslike_c: -2.9,
					feelslike_f: 26.7,
					gust_kph: 15.8,
					gust_mph: 9.8,
					humidity: 55,
					is_day: 1,
					last_updated: "1999-01-09 10:40",
					last_updated_epoch: null,
					precip_in: 0,
					precip_mm: 0,
					pressure_in: 30.4,
					pressure_mb: 1013,
					temp_c: 1,
					temp_f: 33.8,
					uv: 2,
					vis_km: 14,
					vis_miles: 8,
					wind_degree: 180,
					wind_dir: "NW",
					wind_kph: 50,
					wind_mph: 6.9
				}
			},
			live_astro: {
				astronomy: {
					astro: {
						moon_illumination: 63,
						moon_phase: "First Quarter",
						moonrise: "01:40 PM",
						moonset: "02:21 AM",
						sunrise: "07:50 AM",
						sunset: "04:45 PM"
					}
				}
			},
			animation: true,
			wind_factor: 2.4,
			sway_factor: 0.3,
			swiv_factor: 1.0,
			months : {
				01: "January",
				02: "February",
				03: "March",
				04: "April",
				05: "May",
				06: "June",
				07: "July",
				08: "August",
				09: "September",
				10: "October",
				11: "Novermber",
				12: "December"
			},
			mMat: 0,
			cMat:
				{
				0:0,
				1:0,
				2:0,
				3:0,
				4:0,
				5:0,
				6:0,
				7:0,
				8:0, //logo
				9:0,
				10:0,
				11:0,
				12:0,
				13:0
			}
		}
	};

	// data values
    this.data_stored = {
        param: {
			wind: {
				direction: 350,
				speed: 30
			},
			gust: {
				direction: 270,
				speed: 25
			},
			sun: {
				distance: 400,
				inclination: 0.5,
				azimuth: 0.55,
				intensity: 1.5
			},
			sky: {
				turbidity: 10,
				rayleigh: 2,
				luminance: 1,
				mieCoefficient: 0.005,
				mieDirectionalG: 0.8,
				res: 2048
			},
			live_data: {
				current: {
					cloud: 0,
					feelslike_c: -2.9,
					feelslike_f: 26.7,
					gust_kph: 15.8,
					gust_mph: 9.8,
					humidity: 55,
					is_day: 1,
					last_updated: "1999-01-09 10:40",
					last_updated_epoch: null,
					precip_in: 0,
					precip_mm: 0,
					pressure_in: 30.4,
					pressure_mb: 1013,
					temp_c: 1,
					temp_f: 33.8,
					uv: 2,
					vis_km: 14,
					vis_miles: 8,
					wind_degree: 180,
					wind_dir: "NW",
					wind_kph: 50,
					wind_mph: 6.9
				}
			},
			live_astro: {
				astronomy: {
					astro: {
						moon_illumination: 63,
						moon_phase: "First Quarter",
						moonrise: "01:40 PM",
						moonset: "02:21 AM",
						sunrise: "07:50 AM",
						sunset: "04:45 PM"
					}
				}
			},
			animation: true,
			wind_factor: 0.4,
			sway_factor: 0.4,
			swiv_factor: 0.4,
			months : {
				01: "January",
				02: "February",
				03: "March",
				04: "April",
				05: "May",
				06: "June",
				07: "July",
				08: "August",
				09: "September",
				10: "October",
				11: "Novermber",
				12: "December"
			},
			mMat: 0,
			cMat:
				{
				0:0,
				1:0,
				2:0,
				3:0,
				4:0,
				5:0,
				6:0,
				7:0,
				8:0, //logo
				9:0,
				10:0,
				11:0,
				12:0,
				13:0
			}
		}
	};


    this.options = extend( {}, defaults, options );

    this.animations = {};
    this.autorotations = {};
    this.interfaces = [];
    this.clock = new THREE.Clock();
    this.loader = new THREE.SceneLoader();
    this.loader.byRequest = true;
    this.cameraAnimations = {};

    this.preloader = this.options.preloader;

    // Initialization start
    if ( Detector.webgl ) {

        this.init();
    } else {
        Detector.addGetWebGLMessage();
    }
}


IonVR.prototype = {
    constructor : IonVR,

    init : function () {
		THREE.Cache.enabled = true;
        this.initContainer();
        //this.loadCameraAnimations();
        this.loadScene( function () {
            this.initCamera();
            this.initRenderer();
            this.initWater();
			this.fetchWeather();

            if ( this.onReady ) {
                this.onReady();
				this.updateSun();
            }

			if (ion.options.audio == true) {
					ion.initAudio();
				}

            this.start();
			// this.updateSun();

			setTimeout(loadDef, 2800);
			setTimeout(loadEnd, 6000);

			function loadDef() {
				ion.preloader.stop();
				ion.animateParamToSMP2('color', ion.sc.materials.m_cam, { opacity: -0.1 }, 2800, easeInOutSine);
				ion.camera.getObjectByName("audioMain").gain.context.resume();
			}
			function loadEnd() {
				//ion.spinRound();
				ion.sc.objects.cam_mask.visible=false;
				if (ion.data.param.animation !== false) {
				ion.animateHouse();
				} else {}

			}
        } );
    },

    log : function () {
        if ( this.options.debug && window.console ) {
            console.log( arguments );
        }
    },

    loadScene : function ( callback ) {
        var _this = this;

        this.showStatus( 'Loading scene...' );

        var scene_loader = this.loader;
        //scene_loader.byRequest = true;

        scene_loader.callbackProgress = function ( progress ) {
            _this.showStatus( 'Loading... Models ' + progress.loadedModels + '/' + progress.totalModels + ', textures ' + progress.loadedTextures + '/' + progress.totalTextures );
            _this.preloader.updateProgress( progress );
        };

        if ( THREE.IONLoader ) {
            scene_loader.addGeometryHandler( "ion", THREE.IONLoader );
        }

        this.log( 'load scene', this.options.scene );

        // var path = (this.options.scene_assets_url || '') + this.options.scene;
        var path = this.options.scene;
        scene_loader.load( path, function ( sc, b, c ) {
            _this.log( 'load complete', sc, b, c );

            // _this.preloader.stop();

            _this.initScene( sc );
			ion.options.ready = true;


            if ( _this.options.debug ) {
                if ( typeof IonSceneExplorer != 'undefined' ) {
                    _this.explorer = new IonSceneExplorer( _this, sc );
                }
            }
            if ( callback ) {
                callback.call( _this );
            }
        } );

    },

    loadCameraAnimations : function () {

        new THREE.CameraAnimationDataLoad( this );

    },

    loadSecondaryScene : function ( callback ) {

        var _this = this;

        _this.preloader.start();

        this.showStatus( 'Loading scene...' );

        var scene_loader = new THREE.SceneLoader();

        scene_loader.callbackProgress = function ( progress ) {
            _this.showStatus( 'Loading... Models ' + progress.loadedModels + '/' + progress.totalModels + ', textures ' + progress.loadedTextures + '/' + progress.totalTextures );
            _this.preloader.updateProgress( progress );
        };

        if ( THREE.IONLoader ) {
            scene_loader.addGeometryHandler( "ion", THREE.IONLoader );
        }

        this.log( 'load secondary scene', this.options.secondary_scene );
        scene_loader.load( this.options.secondary_scene, function ( sc, b, c ) {
            _this.log( 'load secondary complete', sc, b, c );

            _this.preloader.stop();
            _this.hideStatus();

            _this.initSecondaryScene( sc );

            if ( callback ) {
                callback.call( _this );
            }
        } );

    },

    setMaterial : function ( key, object ) {

        var scope = this;

        this.preloader.start();
        this.loader.callbackProgress = function ( progress ) {
            scope.showStatus( 'Loading... Textures ' + progress.loadedTextures + '/' + progress.totalTextures );
            scope.preloader.updateProgress( progress );
        };

        this.loader.newMaterial( key, function () {
            object.material = scope.sc.materials[ key ];

            scope.applyAnimationToNewMaterial( object );
            //scope.spinRound();
			scope.preloader.stop();
            scope.hideStatus();
			scope.requestRender();

        } )
    },

    showCamInfo : function () {

        if(this.orbit_controls == null) return;

        if ( !this.cam_info ) {
            this.cam_info = $c( 'div' );
            this.cam_info.id = 'camera-info';
            this.container.appendChild( this.cam_info );
        }

        this.cam_info.innerHTML =
            '"position": [' +
            '' + round( this.camera.position.x, 100 ) + ',' +
            '' + round( this.camera.position.y, 100 ) + ',' +
            '' + round( this.camera.position.z, 100 ) + '],<br />' +
            '"target": [' +
            '' + round( this.orbit_controls.target.x, 100 ) + ', ' +
            '' + round( this.orbit_controls.target.y, 100 ) + ', ' +
            '' + round( this.orbit_controls.target.z, 100 ) + '],<br />' +
            '"fov": ' + round( this.camera.fov, 10 ) + '';
        ;

    },

    showLiveWeather : function () {

        if ( !this.weather_info ) {
            this.weather_info = $c( 'div' );
            this.weather_info.id = 'weather-info';
			// this.weather_info.style.z-index = 105;
            this.container.appendChild( this.weather_info );

			this.weather_in = $c( 'div' );
            this.weather_in.id = 'weather-in';
			this.weather_in.onclick = ion.showUI;
			// this.weather_in.style.z-index = 100;
            this.container.appendChild( this.weather_in );

			this.weather_sound = $c( 'div' );
            this.weather_sound.id = 'weather-sound';
			this.weather_sound.onclick = ion.soundSwitch;
			// this.weather_sound.style.z-index = 110;
            this.weather_info.appendChild( this.weather_sound );

			this.weather_bt = $c( 'div' );
            this.weather_bt.id = 'weather-bt';
			this.weather_bt.onclick = ion.hideUI;
			// this.weather_bt.style.z-index = 110;
            this.weather_info.appendChild( this.weather_bt );

            this.weather_dot = $c( 'div' );
            this.weather_dot.id = 'weather-dot';
			// this.weather_dot.style.z-index = 110;
            this.weather_info.appendChild( this.weather_dot );

            this.weather_text = $c( 'div' );
            this.weather_text.id = 'weather-text';
			// this.weather_text.style.z-index = 110;
            this.weather_info.appendChild( this.weather_text );
        };

		var currentDate = this.data.param.live_data.current.last_updated;
		var cTime = new Date(currentDate).toLocaleTimeString();
		var cDay = currentDate.substring(8, 10);
		var cM = currentDate.substring(5, 7);
		var month = ion.data.param.months[cM*1];

		//console.log(cM);

		var iconW = new DOMParser().parseFromString('<svg class="weather_icon" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.50001 6.75H18.125C18.8419 6.75201 19.5407 6.52573 20.1203 6.10395C20.7 5.68217 21.1302 5.0868 21.3488 4.40409C21.5674 3.72139 21.5629 2.98683 21.336 2.30684C21.1092 1.62685 20.6717 1.03676 20.0869 0.62207C19.5022 0.207381 18.8007 -0.0103669 18.0839 0.000379477C17.3672 0.0111259 16.6724 0.249808 16.1004 0.681841C15.5284 1.11387 15.1088 1.71681 14.9024 2.4033C14.696 3.08978 14.7136 3.82415 14.9525 4.49999H3.50001C3.20164 4.49999 2.91549 4.61852 2.70451 4.8295C2.49353 5.04048 2.37501 5.32663 2.37501 5.62499C2.37501 5.92336 2.49353 6.20951 2.70451 6.42049C2.91549 6.63147 3.20164 6.75 3.50001 6.75ZM17 3.37499C17 3.15249 17.066 2.93498 17.1896 2.74997C17.3132 2.56497 17.4889 2.42077 17.6945 2.33563C17.9001 2.25048 18.1263 2.2282 18.3445 2.27161C18.5627 2.31502 18.7632 2.42216 18.9205 2.5795C19.0779 2.73683 19.185 2.93729 19.2284 3.15551C19.2718 3.37374 19.2495 3.59994 19.1644 3.80551C19.0792 4.01108 18.9351 4.18678 18.75 4.3104C18.565 4.43401 18.3475 4.49999 18.125 4.49999C17.8267 4.49999 17.5405 4.38147 17.3295 4.17049C17.1186 3.95951 17 3.67336 17 3.37499ZM25.875 4.37499C25.3359 4.37651 24.805 4.50716 24.3267 4.75601C23.8484 5.00485 23.4367 5.36466 23.1261 5.8053C22.8154 6.24594 22.6149 6.75459 22.5412 7.28866C22.4675 7.82274 22.5228 8.3667 22.7025 8.875H1.125C0.826633 8.875 0.540484 8.99353 0.329505 9.2045C0.118527 9.41548 0 9.70163 0 10C0 10.2984 0.118527 10.5845 0.329505 10.7955C0.540484 11.0065 0.826633 11.125 1.125 11.125H25.875C26.7701 11.125 27.6286 10.7694 28.2615 10.1365C28.8945 9.50355 29.25 8.6451 29.25 7.75C29.25 6.85489 28.8945 5.99644 28.2615 5.36351C27.6286 4.73057 26.7701 4.37499 25.875 4.37499ZM25.875 8.875C25.6525 8.875 25.435 8.80902 25.25 8.6854C25.065 8.56178 24.9208 8.38608 24.8357 8.18052C24.7505 7.97495 24.7282 7.74875 24.7717 7.53052C24.8151 7.31229 24.9222 7.11184 25.0795 6.9545C25.2369 6.79717 25.4373 6.69002 25.6556 6.64661C25.8738 6.6032 26.1 6.62548 26.3056 6.71063C26.5111 6.79578 26.6868 6.93997 26.8104 7.12498C26.9341 7.30998 27 7.52749 27 7.75C27 8.04837 26.8815 8.33451 26.6705 8.54549C26.4596 8.75647 26.1734 8.875 25.875 8.875ZM21.375 13.25H2.25C1.95163 13.25 1.66549 13.3685 1.45451 13.5795C1.24353 13.7905 1.125 14.0766 1.125 14.375C1.125 14.6734 1.24353 14.9595 1.45451 15.1705C1.66549 15.3815 1.95163 15.5 2.25 15.5H18.2025C17.9636 16.1758 17.946 16.9102 18.1524 17.5967C18.3588 18.2832 18.7784 18.8861 19.3504 19.3182C19.9224 19.7502 20.6172 19.9889 21.3339 19.9996C22.0507 20.0104 22.7522 19.7926 23.337 19.3779C23.9217 18.9632 24.3592 18.3731 24.586 17.6932C24.8129 17.0132 24.8174 16.2786 24.5988 15.5959C24.3802 14.9132 23.95 14.3178 23.3703 13.896C22.7907 13.4743 22.0919 13.248 21.375 13.25ZM21.375 17.75C21.1525 17.75 20.935 17.684 20.75 17.5604C20.565 17.4368 20.4208 17.2611 20.3357 17.0555C20.2505 16.85 20.2282 16.6238 20.2716 16.4055C20.3151 16.1873 20.4222 15.9868 20.5795 15.8295C20.7369 15.6722 20.9373 15.565 21.1556 15.5216C21.3738 15.4782 21.6 15.5005 21.8055 15.5856C22.0111 15.6708 22.1868 15.815 22.3104 16C22.4341 16.185 22.5 16.4025 22.5 16.625C22.5 16.9234 22.3815 17.2095 22.1705 17.4205C21.9595 17.6315 21.6734 17.75 21.375 17.75Z" fill="black" fill-opacity="0.74"/></svg>' , 'application/xml');

		var iconD = new DOMParser().parseFromString('<svg class="weather_icon" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 0C4.93263 0 0 4.93263 0 11C0 17.0674 4.93263 22 11 22C17.0674 22 22 17.0674 22 11C22 4.93263 17.0674 0 11 0ZM11 19.8695C6.11368 19.8695 2.13053 15.8863 2.13053 11C2.13053 6.11368 6.11368 2.13053 11 2.13053C15.8863 2.13053 19.8695 6.11368 19.8695 11C19.8695 15.8863 15.8863 19.8695 11 19.8695Z" fill="black" fill-opacity="0.74"/><path d="M14.7286 5.9053L9.24013 8.29056C8.80013 8.47582 8.45276 8.82319 8.2675 9.26319L5.90539 14.7285C5.53487 15.5853 6.41487 16.4653 7.27171 16.0948L12.7601 13.7095C13.2001 13.5242 13.5475 13.1769 13.7328 12.7369L16.0949 7.27161C16.4886 6.39161 15.6086 5.51161 14.7286 5.9053ZM11.9728 11.9727C11.4401 12.5053 10.5833 12.5053 10.0507 11.9727C9.51803 11.44 9.51803 10.5832 10.0507 10.0506C10.5833 9.51793 11.4401 9.51793 11.9728 10.0506C12.5054 10.56 12.5054 11.44 11.9728 11.9727Z" fill="black" fill-opacity="0.74"/></svg>' , 'application/xml');

		var iconB = new DOMParser().parseFromString('<svg class="weather_icon" width="20" height="20" viewBox="0 0 20 20" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M11.1785 10L13.831 12.6525C14.156 12.9775 14.1579 13.5025 13.8302 13.8302C13.5047 14.1556 12.9772 14.1557 12.6525 13.831L10 11.1785L7.34747 13.831C7.02252 14.156 6.49754 14.1579 6.16984 13.8302C5.8444 13.5047 5.84427 12.9772 6.16896 12.6525L8.82149 10L6.16896 7.34747C5.84401 7.02252 5.84213 6.49754 6.16984 6.16984C6.49528 5.8444 7.02278 5.84427 7.34747 6.16896L10 8.82149L12.6525 6.16896C12.9775 5.84401 13.5025 5.84213 13.8302 6.16984C14.1556 6.49528 14.1557 7.02278 13.831 7.34747L11.1785 10ZM10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20ZM10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"  fill-opacity="0.5"/></svg>' , 'application/xml');

		var iconI = new DOMParser().parseFromString('<svg class="weather_icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.3728 0 0 5.3728 0 12C0 18.6272 5.3728 24 12 24C18.6272 24 24 18.6272 24 12C24 5.3728 18.6272 0 12 0ZM10.6133 17.1797V11.6864C10.6133 11.3186 10.7594 10.9659 11.0195 10.7059C11.2795 10.4458 11.6322 10.2997 12 10.2997C12.3678 10.2997 12.7205 10.4458 12.9805 10.7059C13.2406 10.9659 13.3867 11.3186 13.3867 11.6864V17.1797C13.3867 17.5475 13.2406 17.9002 12.9805 18.1603C12.7205 18.4203 12.3678 18.5664 12 18.5664C11.6322 18.5664 11.2795 18.4203 11.0195 18.1603C10.7594 17.9002 10.6133 17.5475 10.6133 17.1797ZM12 8.78667C11.6704 8.78667 11.3481 8.68892 11.074 8.50578C10.8 8.32265 10.5863 8.06235 10.4602 7.75781C10.3341 7.45326 10.301 7.11815 10.3654 6.79485C10.4297 6.47155 10.5884 6.17458 10.8215 5.94149C11.0546 5.7084 11.3515 5.54967 11.6748 5.48536C11.9982 5.42105 12.3333 5.45405 12.6378 5.5802C12.9423 5.70635 13.2026 5.91997 13.3858 6.19405C13.5689 6.46813 13.6667 6.79036 13.6667 7.12C13.6667 7.56203 13.4911 7.98595 13.1785 8.29851C12.866 8.61107 12.442 8.78667 12 8.78667Z" fill="white"/></svg>' , 'application/xml');

        this.weather_dot.innerHTML =
		'●';
        this.weather_text.innerHTML =
		'&nbsp&nbsp' + 'Atlantic Ocean, ' + month + ' ' + cDay + ' at ' + cTime +
		'&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp';

		this.weather_text.appendChild(iconW.documentElement);

		this.weather_text.innerHTML +=
		'&nbsp&nbsp' + round( this.data.param.live_data.current.wind_kph, 100 ) + ' km/h' +
		'&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp';

		this.weather_text.appendChild(iconD.documentElement);

		this.weather_text.innerHTML +=
		'&nbsp&nbsp' + round( this.data.param.live_data.current.wind_degree, 100 ) + 'º' + ' ' + ion.data.param.live_data.current.wind_dir;

		this.weather_sound.innerHTML =
		'';

        this.weather_bt.innerHTML =
		'';
		// this.weather_bt.appendChild(iconB.documentElement);

        this.weather_in.innerHTML =
		'';
		// this.weather_in.appendChild(iconI.documentElement);


    },

	showUI : function() {
		document.getElementById('weather-info').style.bottom="0%"
	},

	hideUI : function() {
		document.getElementById('weather-info').style.bottom="-10%"
	},

	soundSwitch: function() {

		if (ion.options.audio == true ) {
			document.getElementById('weather-sound').style.backgroundColor= "#ff532f";
			document.getElementById('weather-sound').style.opacity=0.8;
			ion.camera.getObjectByName('audioMain').gain.context.resume();
			ion.options.audio=false;
		} else {
			document.getElementById('weather-sound').style.backgroundColor= "#818181";
			ion.camera.getObjectByName('audioMain').gain.context.suspend();
			ion.options.audio=true;
		}

	},

    initScene : function ( sc ) {

        this.separateInterfaceGroup( sc );

        this.sc = sc;

        this.scene = sc.scene;
        this.main_group = this.scene.getObjectByName( 'main_group' );


        for ( var i in this.main_group.children ) {
            var obj = this.main_group.children[ i ];

            if ( obj instanceof THREE.Mesh && obj.userData ) {
                if ( obj.userData.sub_div ) {
                    var sub_div = obj.userData.sub_div;
                    this.log( 'sub div', obj.name, sub_div );
                    this.showStatus( 'Subdividing ' + obj.name );

                    var modifier = new THREE.SubdivisionModifier( sub_div );
                    modifier.modify( obj.geometry );
                }

                if ( obj.userData.comp_vn ) {
                    this.log( 'comp vn', obj.name );
                    this.showStatus( 'Computing normals ' + obj.name );
                    obj.geometry.computeVertexNormals();
                }

                if ( obj.userData.comp_fn ) {
                    this.log( 'comp fn', obj.name );
                    this.showStatus( 'Computing face normals ' + obj.name );
                    obj.geometry.computeFaceNormals();
                }

                if ( obj.userData.comp_cn ) {
                    this.log( 'comp cn', obj.name );
                    this.showStatus( 'Computing centroids ' + obj.name );
                    obj.geometry.computeCentroids();
                }

                if ( obj.userData.buffer && this.options.geom_buffer && THREE.BufferGeometryUtils ) {
                    delete obj.geometry.__tmpVertices; // bug fix, may also use clone
                    //obj.geometry = obj.geometry.clone();

                    this.showStatus( 'Triangulating ' + obj.name );
                    THREE.GeometryUtils.triangulateQuads( obj.geometry );

                    this.showStatus( 'Buffering ' + obj.name );
                    var new_geo = THREE.BufferGeometryUtils.fromGeometry( obj.geometry );
                    obj.geometry.dispose();
                    obj.geometry = new_geo;

                    //obj.material = this.sc.materials.wire_orange;
                }
            }
        }

        this.log( 'main_group', this.main_group );

        this.main_group.rotation.y = this.options.rotate_left;
		this.log('init_rotation',this.options.rotate_left)


        // skybox
        if ( this.options.skybox ) {
            var shader = THREE.ShaderLib[ "cube_y" ]; // vertical offset cube shader
            shader.uniforms[ "tCube" ].value = this.sc.textures[ this.options.skybox_tx ];
            var material = new THREE.ShaderMaterial( {
                    fragmentShader : shader.fragmentShader,
                    vertexShader : shader.vertexShader,
                    uniforms : shader.uniforms,
                    depthWrite : false,
                    side : THREE.BackSide
                } ),

            skybox = new THREE.Mesh( new THREE.CubeGeometry( 10000, 10000, 10000 ), material );
            skybox.position.set( 0, 0, 0 );
            //this.scene.add( skybox );
			this.scene.background = this.sc.textures[this.options.skybox_tx];
        }

        // sky
        if ( this.options.sky ) {

			var sunLight = new THREE.DirectionalLight( 0xfeeacc, this.data.param.sun.intensity );
			sunLight.position.set(380, 4.3, 123);
			sunLight.name = 'sunLight';

            var sky = new THREE.Sky();
			sky.name = 'sky';
			var uniforms = sky.material.uniforms;

			uniforms[ 'turbidity' ].value = this.data.param.sky.turbidity;
			uniforms[ 'rayleigh' ].value = this.data.param.sky.rayleigh;
			uniforms[ 'luminance' ].value = this.data.param.sky.luminance;
			uniforms[ 'mieCoefficient' ].value = this.data.param.sky.mieCoefficient;
			uniforms[ 'mieDirectionalG' ].value = this.data.param.sky.mieDirectionalG;

			var cubeCamera = new THREE.CubeCamera( 0.1, 1, this.data.param.sky.res );
			cubeCamera.renderTarget.texture.generateMipmaps = true;
			cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
			cubeCamera.name = 'cubeCamera';

			this.scene.background = cubeCamera.renderTarget;
			this.scene.add( sunLight );
			this.scene.add( cubeCamera );
			this.scene.add( sky );
			ion.sc.objects.house.material[0].envMap =
			ion.sc.objects.house.material[1].envMap =
			ion.sc.objects.house.material[2].envMap = cubeCamera.renderTarget.texture;
        }

		if ( this.options.lightprobe ) {

			var lightProbe = new THREE.LightProbe();
			lightProbe.name = 'lightProbe';
			this.scene.add( lightProbe );
			if (this.options.lightprobe_comp == true ) {
				lightProbe.copy( THREE.LightProbeGenerator.fromCubeTexture( this.sc.textures[ this.options.lightprobe_tx ] ) );
			} else {};
			lightProbe.intensity =  this.options.lightprobeInt;

			if (this.options.lightprobe_set == "env_cube1") {
			// city bg sh
			lightProbe.sh.fromArray([
				0.21988952323971958,
				0.353873883080967,
				0.5979957196333927,
				0.06558677467388137,
				0.168535799494315,
				0.3727295821407715,
				-2.838907723444506e-14,
				-3.954370089901607e-14,
				-4.022441719324286e-14,
				2.838929245680154e-14,
				3.954331642208093e-14,
				4.0224862808547535e-14,
				-1.0201367426154214e-15,
				5.862222392184944e-15,
				-6.706257573915519e-15,
				1.0201908564157353e-15,
				-5.861917556646891e-15,
				6.7057196117202916e-15,
				0.09217011442613726,
				0.10671077188574228,
				0.11792560917973822,
				-4.880465721524953e-19,
				9.756262751934876e-19,
				-4.760480508502691e-18,
				0.15964303814943762,
				0.18482815100295383,
				0.20425278456377272]);
			} else if (this.options.lightprobe_set == "studio1") {
			//studio sh
			lightProbe.sh.fromArray([
				0.029401531146369564,
				0.030393056150284967,
				0.03882441978503216,
				-0.006532247813053846,
				-0.006830553369357048,
				-0.00876550792363131,
				0.0054872013622510795,
				0.005761665763592089,
				0.007102911675978676,
				0.001051650901536813,
				0.0008596636445337802,
				0.0006091165567122502,
				-0.0036529445742401667,
				-0.003961831226970255,
				-0.005260862974352544,
				-0.004670203370822745,
				-0.005086150563277629,
				-0.0060334392731383295,
				-0.0005266474551182757,
				-0.0005770949473494129,
				-0.0006364091203026864,
				0.0027920785910252243,
				0.00304628013386876,
				0.004018038061411669,
				0.0005419559484224849,
				0.0005783680671260237,
				0.0008420237221743866
				]);
			} else if (this.options.lightprobe_set == "ext1") {
			//ext1
			lightProbe.sh.fromArray([
				1.0406571709113295,
				1.161886628443305,
				1.3063027226917772,
				-0.6490791656527983,
				-0.49548467256667383,
				-0.31325949844248935,
				0.04381565686615428,
				0.06532099855040499,
				0.07807386785800434,
				0.08630908113628857,
				-0.10730147835215309,
				-0.10939680130133521,
				-0.22306053341686657,
				-0.2557966190958097,
				-0.2506786037181489,
				0.020464629184951535,
				0.028274316528776787,
				0.0298683696140515,
				-0.09474396955458116,
				-0.10071400468444641,
				-0.11257025430936203,
				-0.040398956433938614,
				-0.044402750362525285,
				-0.04342718627203005,
				0.14164765158865514,
				0.15794017769014346,
				0.12746705307744025
				]);
			} else {}
		}

		this.o = this.sc.objects;
		this.m = this.sc.materials;
		this.t = this.sc.textures;
		this.c = this.sc.cameras;
		this.pc = this.data.param;
    },

	updateSun : function() {

		var cTime = new Date(ion.data.param.live_data.current.last_updated).getHours();
		var cMin = new Date(ion.data.param.live_data.current.last_updated).getMinutes();

		var cHour = cTime + (cMin * 0.016666);
		var aziF = 0.5 + (cHour-7)/22;

		if ( aziF < 0.55 ) {
			var azi = 0.55;
		} else if ( aziF >= 0.55 && aziF <= 0.95) {
			var azi = aziF;
		} else if ( aziF > 0.95 ) {
			var azi = 0.95;
		}

		if (cHour < 12 ) {
			var inc = cHour/15;
		} else if (cHour >= 12 ) {
			var inc = 0.75-((cHour-12)/17);
		} else {
			//var inc = 0.3
		}

		this.data.param.sun.inclination = inc;
		this.data.param.sun.azimuth = azi;

		// var inc = this.data.param.sun.inclination;
		// var azi = this.data.param.sun.azimuth;

		//console.log('inc:', inc, 'azi:', azi)

		var sunLightparam = this.data.param.sun;
		var sunLight = this.scene.getObjectByName('sunLight');
		var cubeCamera = this.scene.getObjectByName('cubeCamera');
		var sky = this.scene.getObjectByName('sky');

		var theta = Math.PI * ( inc - 0.4 ); // 0.4 sunrise 6am
		var phi = 2 * Math.PI * ( azi - 0.5 );

		var sX = sunLightparam.distance * Math.cos( phi );
		var sY = sunLightparam.distance * Math.sin( phi ) * Math.sin( theta );
		var sZ = sunLightparam.distance * Math.sin( phi ) * Math.cos( theta );
		var sP = { r: sX, g: sY, b: sZ };
		//console.log('sP:', sP);

		ion.animateParamToSMP6('position', sunLight.position, { x: sX, y: sY, z: sZ }, 800, easeInOutSine);
		setTimeout(stepOne, 900);

		function stepOne() {
			ion.scene.getObjectByName('sky').material.uniforms[ 'sunPosition' ].value = sP;
			ion.scene.getObjectByName('cubeCamera').update( ion.renderer, ion.scene.getObjectByName('sky') );
			//ion.requestRender();
			//console.log('sunLight.position:', ion.scene.getObjectByName('sunLight').position);
		}

		if (inc > 0.5 && inc < 1.01  ) {
				var ambInt = 0.1 + (inc - 0.2)
			} else {
				var ambInt = 0.1;
			}
		ion.animateParamToSMP('intensity', ion.scene.getObjectByName('light_ambient'), {intensity: ambInt}, 800, easeInOutSine);

		if (inc > 0.46 && inc < 0.8  ) {
			var rgbF = (-0.75+(inc)) * -2.2;
			var lMult = 0.85;
			var sRv = (0.95 * lMult) - rgbF;
			var sGv = (0.88 * lMult) - rgbF;
			var sBv = (0.72 * lMult) - rgbF;
			var envMult = 1.5+(rgbF *5.5);


			if (sRv >= 0 && sRv < 1) {
				var sR = sRv;
			} else {
				var sR = 0;
			}
			if (sGv >= 0 && sGv < 1) {
				var sG = sGv;
			} else {
				var sG = 0;
			}
			if (sBv >= 0 && sBv < 1) {
				var sB = sBv;
			} else {
				var sB = 0;
			}

			ion.animateParamToSMP('color', ion.scene.getObjectByName('sunLight').color, { r: sR, g: sG, b: sB }, 800, easeInOutSine);
			// console.log('case1:', rgbF)
			// console.log('envMult:', envMult);
			ion.sc.materials.m_04.envMapIntensity = ion.sc.materials.m_01.envMapIntensity = envMult;

			setTimeout(stepOne, 1600);

			function stepOne() {
				ion.animateParamToSMP('color', ion.scene.getObjectByName('light_cam').color, { r: sR, g: sG, b: sB }, 800, easeInOutSine);
			}
		} else {
			ion.animateParamToSMP('color', ion.scene.getObjectByName('sunLight').color, { r: 0.01, g: 0.01, b: 0.02 }, 1600, easeInOutSine);
			ion.sc.materials.m_04.envMapIntensity = ion.sc.materials.m_01.envMapIntensity = 7;
			//console.log('case3')

			setTimeout(stepOne, 1600);

			function stepOne() {
				ion.animateParamToSMP('color', ion.scene.getObjectByName('light_cam').color, { r: 0.004, g: 0.004, b: 0.02 }, 800, easeInOutSine);
			}
		}

	},

	initAudio : function() {

		const listener = new THREE.AudioListener();
		listener.name = 'audioMain';
		this.camera.add( listener );

		// create a global audio source
		const sound = new THREE.Audio( listener );

		// load a sound and set it as the Audio object's buffer
		const audioLoader = new THREE.AudioLoader();
		audioLoader.load( this.options.audio_track, function( buffer ) {
			sound.setBuffer( buffer );
			sound.setLoop( true );
			sound.setVolume( 0.9 );
			sound.play();
		});
		this.camera.getObjectByName("audioMain").gain.context.sampleRate=44100;
	},

    initWater : function ( sc ) {

       // Water

		var waterGeometry = new THREE.PlaneBufferGeometry( 12000, 12000 );

		var water = new THREE.Water(
			waterGeometry,
			{
				textureWidth: 1024,
				textureHeight: 1024,
				waterNormals: new THREE.TextureLoader().load( '_yh1/_tex/waternormals.jpg', function ( texture ) {

					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

				} ),
				alpha: 0.7,
				//sunDirection: (0.3, 0.4),
				sunColor: 0x888888,
				waterColor: 0x484C54,
				fogColor: 0xfeeacc,
				distortionScale: 3.7
			}
		);

		water.rotation.x = -Math.PI / 2;
		water.position.y = -24;
		water.name = 'water';

		//water.material.uniforms[ 'time' ].value += 1.0 / 60.0;

		ion.scene.getObjectByName('main_group').add( water );
		ion.requestRender();
    },

    separateInterfaceGroup : function ( contents ) {

        var index = 0;
        var scope = this;

        while ( true ) {

            var interfaceObject = contents.scene.getObjectByName( 'interface_group' + (index++) );
            if ( interfaceObject ) {

                var interfaceFrame = new THREE.InterfaceFrame( this, interfaceObject.userData );
                contents.scene.remove( interfaceObject );
                interfaceFrame.scene.add( interfaceObject );
                scope.interfaces.push( interfaceFrame );

            } else
                break;
        }


    },

    initSecondaryScene : function ( contents ) {

        this.secondary_sc = contents;
        this.secondary_group = contents.scene.getObjectByName( 'main_group' );

        for ( var i = 0; i < contents.scene.children.length; i++ ) {

            this.scene.add( contents.scene.children[ i ] );

        }
        this.secondary_group.rotation.set( this.main_group.rotation.x, this.main_group.rotation.y, this.main_group.rotation.z );
        this.render();
    },

    initContainer : function () {
        if ( this.options.container && this.options.container instanceof HTMLElement ) {
            this.container = this.options.container;
        } else {
            this.container = $c( 'div' );
            document.body.appendChild( this.container );
        }

        if( this.options.showStatus){
            this.status_info = $c( 'div' );
            this.status_info.id = 'status-info';
            this.container.appendChild( this.status_info );
            this.showStatus( 'Loading...' );
        }

        this.container.style.animationDuration = '1s';

        this.updateAspect();


    },

    addCamerasButtons : function ( parent ) {
        if ( !parent ) return;

        var _this = this;

        for ( var cam_name in this.sc.cameras ) {
            var link = $c( 'a' );
            link.setAttribute( 'data-target', cam_name );
            link.innerHTML = cam_name;

            link.addEventListener( 'click', function () {
                var cam_name = this.getAttribute( 'data-target' );
                _this.switchCamera( cam_name );
                return false;
            } );

            parent.appendChild( link );
        }
    },

    initCamera : function () {
        var _this = this;

        var op = this.options.camera;
        var pos = op.position;


        // select camera
        if ( this.sc.currentCamera ) {
            this.camera = this.sc.currentCamera;
        } else if ( any( this.sc.cameras ) ) {
            this.camera = first( this.sc.cameras );
        } else {
            this.log( 'create camera' );
            this.camera = new THREE.PerspectiveCamera( 35, this.aspect.width / this.aspect.height, 0.1, 1500 );
            this.camera.position.set( pos.x, pos.y, pos.z );
        }

        //this.camera.lookAt( this.scene.position );

        // preserve before switch
        this.camera.userData.default_position = {
            x : this.camera.position.x,
            y : this.camera.position.y,
            z : this.camera.position.z
        };
        this.camera.userData.default_fov = this.camera.fov;

        this.camera.userData.default_target = this.camera.target;

        this.log( 'camera', this.camera );

        this.cam_group = new THREE.Object3D();
        this.cam_group.add( this.camera );
        this.scene.add( this.cam_group );

        window.addEventListener( 'resize', function () {
            _this.updateCameraAspect();
        } );

        if ( typeof IonMouseControl !== 'undefined' ) {
            this.controls = new IonMouseControl( this, { debug : this.options.debug } );
        } else if ( THREE.OrbitControls ) {
            this.orbit_controls = new THREE.OrbitControls( this.camera, this.container );
            this.orbit_controls.enableDamping = this.camera.userData.parameters.enableDamping;
            this.orbit_controls.dampingFactor = this.camera.userData.parameters.dampingFactor;
			this.orbit_controls.minDistance = this.camera.userData.parameters.minDistance;
			this.orbit_controls.maxDistance = this.camera.userData.parameters.maxDistance;
			this.orbit_controls.minPolarAngle = this.camera.userData.parameters.minPolarAngle;
			this.orbit_controls.maxPolarAngle = this.camera.userData.parameters.maxPolarAngle;
			this.orbit_controls.panSpeed = this.camera.userData.parameters.panSpeed;
			this.orbit_controls.rotateSpeed = this.camera.userData.parameters.rotateSpeed;
			this.orbit_controls.zoomSpeed = this.camera.userData.parameters.zoomSpeed;
			this.orbit_controls.enableRotate = this.camera.userData.parameters.enableRotate;
			this.orbit_controls.enableZoom = this.camera.userData.parameters.enableZoom;
			if (this.camera.userData.parameters.enablePan == true) {
				this.orbit_controls.enablePan = true;
			} else {
				this.orbit_controls.enablePan = false;
			}

			if (this.camera.userData.parameters.screenSpacePanning !== undefined) {
				this.orbit_controls.screenSpacePanning = this.camera.userData.parameters.screenSpacePanning;
			} else {
				this.orbit_controls.screenSpacePanning = true;
			}

            this.orbit_controls.addEventListener( 'change', function () {
                _this.log( 'cont change' );

                _this.requestRender();
            } );

            this.cameraAnimationHelper = new THREE.CameraAnimationHelper( this );

        }

        if ( this.options.camera_info ) {
            this.showCamInfo();
        }
    },

    updateAspect : function () {
        this.aspect = {
            width : this.container.clientWidth,
            height : this.container.clientHeight
        }
    },

    updateCameraAspect : function () {
        if ( this.renderer == null ) return;

        this.updateAspect();
        this.camera.aspect = this.aspect.width / this.aspect.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( this.aspect.width, this.aspect.height );
        this.requestRender()
    },

    initRenderer : function () {
        var _this = this;

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias : true, alpha : true, powerPreference: "high-performance", precision: "highp" } );
        this.renderer.gammaFactor = this.options.g_f;
        this.renderer.gammaInput = this.options.g_in;
        this.renderer.gammaOutput = this.options.g_out;
        this.renderer.physicallyBasedShading = this.options.phys_shading;
        this.renderer.toneMappingExposure = this.options.exposure;
		//this.renderer.setClearColor( '#ffffff' );

        this.renderer.setSize( this.aspect.width, this.aspect.height );

        this.container.appendChild( this.renderer.domElement );

        this.updateCameraAspect();

        // stats
        if ( this.options.stats ) {
            this.stats = new Stats();
            this.container.appendChild( this.stats.domElement );

            // render info
            var ri_cont = $c( 'div' );
            ri_cont.id = 'render-info';
            this.container.appendChild( ri_cont );

            this.render_info = $c( 'pre' );
            ri_cont.appendChild( this.render_info );

            var ri_refresh = $c( 'a' );
            ri_refresh.innerHTML = 'Refresh';
            ri_cont.appendChild( ri_refresh );
            ri_refresh.addEventListener( 'click', function () {
                _this.updateRenderInfo();
            } );

            this.updateRenderInfo();
        }

        if ( this.explorer ) {
            this.explorer.init();
        }
    },

    updateRenderInfo : function () {
        var i = this.renderer.info;

        this.render_info.innerHTML =
            '<ul>' +
            '<li>memory' +
            '<ul>' +
            '<li>geometries ' + i.memory.geometries + '</li>' +
            '<li>programs ' + i.memory.programs + '</li>' +
            '<li>textures ' + i.memory.textures + '</li>' +
            '</ul>' +
            '</li>' +
            '<li>render' +
            '<ul>' +
            '<li>calls ' + i.render.calls + '</li>' +
            '<li>faces ' + i.render.faces + '</li>' +
            '<li>points ' + i.render.points + '</li>' +
            '<li>vertices ' + i.render.vertices + '</li>' +
            '</ul>' +
            '</li>' +
            '<li>ts ' + (Date.now()) + '</li>' +
            '</ul>';


    },

    showStatus : function ( text ) {
        if( !this.options.showStatus ) return;
        var el = this.status_info;

        el.innerHTML = text;
        el.style.display = 'block';
    },

    hideStatus : function () {
        if(this.status_info)
            this.status_info.style.display = 'none';
    },

    start : function () {
        var scope = this;
        var start_time = (+new Date);


        this.showStatus( 'Rendering...' );
        this.animate();
        this.animate_simple();
        this.hideStatus();

        this.log( 'started', (+new Date) - start_time );

        this.spinRound();
/*
        if ( this.options.secondary_scene != null )
            setTimeout( function () {
                scope.loadSecondaryScene();
            }, 1100 );
*/
        this.animationHelper = new THREE.AnimationsHelper(
            this,
            function (name, arguments, duration, delay, easing, callback, endCallback) {

                scope.animateParamTo(name, arguments, duration, delay, easing, callback, endCallback);
				//scope.animateParamToSMP(name, obj, end, duration, easing, callback); // very strange

            });
        this.requestRender();

    },

    requestRender : function () {
        this.needRender = true;
    },

    spinRound: function () {
    	if (this.options.spin) {
    		this.animateParamToSMP('rotate', this.main_group.rotation, { x: 0, y: this.options.rotate_left +(Math.PI * 2), z: 0 }, 900, easeInOutCubic);
    		this.log('spin');
            setTimeout(resetY, 1000);

			function resetY() {
			ion.sc.objects.main_group.rotation.y = ion.options.rotate_left;
				}
    	} else {}
    },

    applyAnimationToNewMaterial : function ( object ) {

        var dataClick = object.userData.click;

        if ( dataClick ) {

            for ( var key in dataClick ) {
                var args = dataClick[ key ].backAnimation;
                if ( args ) {

                    for ( var argKey in args ) {

                        if ( argKey.indexOf( 'material' ) > -1 ) {

                            setArgs( argKey, dataClick[ key ].clickOn ? args[ argKey ].obj : args[ argKey ].end );
                        }

                    }

                }

            }

        }
        function setArgs ( key, data ) {

            if ( data instanceof Object ) {

                var objectArgument = getDiffArgument( key, object )
                for ( var dataKey in data ) {
                    objectArgument[ dataKey ] = data[ dataKey ];
                }

            } else {
                setParam( key, data );
            }
        }


        function setParam ( key, value ) {

            var array = key.split( '.' );
            if ( array.length > 1 ) {
                if ( array.length == 2 )
                    object[ array[ 0 ] ][ array[ 1 ] ] = value;
                else if ( array.length == 3 )
                    object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ] = value;
                else if ( array.length == 4 )
                    object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ] = value;
                else if ( array.length == 5 )
                    object[ array[ 0 ] ][ array[ 1 ] ][ array[ 2 ] ][ array[ 3 ] ][ array[ 4 ] ] = value;

            } else {
                object[ key ] = value;
            }

        }
    },

    animateParamToSky: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };
		//this.scene.getObjectByName('cubeCamera').update( this.renderer, this.scene.getObjectByName('sky') );
        //console.log('anim', name, obj, end, duration);
    },

    animateParamToSMP: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        //console.log('anim', name, obj, end, duration);
    },

    animateParamToSMP2: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        //console.log('anim', name, obj, end, duration);
    },

    animateParamToSMP3: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        // console.log('anim', name, obj, end, duration);
    },


    animateParamToSMP4: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        //this.log('anim', name, obj, end, duration);
    },


    animateParamToSMP5: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        //console.log('anim', name, obj, end, duration);
    },


    animateParamToSMP6: function (name, obj, end, duration, easing, callback) {
        // clone hash
        var start = extend({}, end),
            delta = extend({}, end);

        // fill values
        for (var param in end) {
            start[param] = obj[param];
            delta[param] = end[param] - obj[param];
        }

        this.animations[name] = {
            obj: obj,
            start: start,
            delta: delta,
            callback: callback,
            duration: duration,
            easing: easing || easeInOutCubic,
            started: (+new Date)
        };

        //console.log('anim', name, obj, end, duration);
    },

    animateParamTo: function (name, arguments, duration, delay, easing, callback, callbackEnd) {

        this.animations[name] = {
            args: {},
            callback: callback,
            callbackEnd: callbackEnd,
            duration: duration,
            easing: easing || easeOutCubic,
            started: (+new Date) + delay
        };

        for (var argument in arguments) {

            if (arguments[argument].obj instanceof Object) {
                var obj = {};

                var end = {};

                for (var key in arguments[argument].obj) {
                    if (['x', 'y', 'z', 'w', 'r', 'g', 'b'].indexOf(key) >= 0) {
                        obj[key] = arguments[argument].obj[key];
                        end[key] = arguments[argument].end[key];
                    }
                }

                var start = extend({}, end);
                var delta = extend({}, end);

                for (var param in end) {
                    start[param] = obj[param];
                    delta[param] = end[param] - obj[param];
                }
            } else {

                var obj = arguments[argument].obj;
                var end = arguments[argument].end;
                var start = obj;
                var delta = end - obj;
            }

            this.animations[name].args[argument] = {
                obj: obj,
                start: start,
                delta: delta
            };
        }
		//this.log(name, arguments, duration, delay, easing, callback, callbackEnd);
    },

    // {x: 0, y: 0}
    setRotation: function (rotate) {
        this.animateParamToSMP('rotate', this.cam_group.rotation, rotate, 1000, easeOutCubic);
    },

    setFov: function (fov) {
        this.animateParamToSMP('fov', this.camera, {
            fov: fov
        }, 8000, easeOutCubic);
    },

    switchCamera : function ( cam_name, duration, easingCam ) {
        var scope = this;
        var cameraCurrentView = this.sc.cameras[ cam_name ];

        if ( cameraCurrentView ) {

            var easing = easingCam || (cameraCurrentView.userData ? cameraCurrentView.userData.easing : undefined);

            if( easing == null )
                duration = 0;

            if ( this.camera.name == cam_name ) {
                var new_pos = this.camera.userData.default_position;
                var new_fov = this.camera.userData.default_fov;
                var target = this.camera.userData.default_target;

            } else {
                var new_cam = this.sc.cameras[ cam_name ];
                var new_pos = new_cam.position
                    ? { x : new_cam.position.x, y : new_cam.position.y, z : new_cam.position.z }
                    : this.options.camera.position;
                var new_fov = new_cam.fov || this.options.camera.fov;
                var target = new_cam.target || this.options.camera.target;
            }

            var arguments = {

                position : new_pos,
                target : target,
                fov : new_fov,
                easing : easing
            };

            this.moveCamera( 'camera_fov', arguments, duration, undefined, easing, function () {
                scope.cameraAnimationHelper.applyOptions( cameraCurrentView );
            } )


        }
    },

    switchTarget: function (cam_name, duration, easingCam) {
        var scope = this;
        var cameraCurrentView = this.sc.cameras[cam_name];

        if (cameraCurrentView) {

            var easing = easingCam || (cameraCurrentView.userData ? cameraCurrentView.userData.easing : undefined);

            if (easing == null)
                duration = 0;

            if (this.camera.name == cam_name) {
                var new_fov = this.camera.userData.default_fov;
                var target = this.camera.userData.default_target;

            } else {
                var new_cam = this.sc.cameras[cam_name];
                var new_fov = new_cam.fov || this.options.camera.fov;
                var target = new_cam.target || this.options.camera.target;
            }412

            var arguments = {

                target: target,
                fov: new_fov,
                easing: easing
            };

            this.moveCamera('camera_fov', arguments, duration, undefined, easing, function () {
                scope.cameraAnimationHelper.applyOptions(cameraCurrentView);
            })

        }
    },

    moveCamera: function (animationName, arguments, duration, delay, easing, onAnimate) {

        var scope = this;
        animate(arguments, duration == 0 ? 0 : duration || 1800, delay || 0);

        function animate(args, duration, delay) {

            scope.orbit_controls.focus(
                args,
                function (name, arguments, callback, callbackEnd) {

                    if (easing == null) {
                        scope.container.style.animationName = "changeCamera";
                        setTimeout(function () {
                            scope.animateParamTo(animationName, arguments, duration, delay, getCurve(easing), callback, callbackEnd);
                            scope.container.style.animationName = "";
                        }, 500);
                    } else {
                        scope.animateParamTo(animationName, arguments, duration, delay, getCurve(easing), callback, callbackEnd);
                    }

                },
                onAnimate);

        }
    },

    animateCamera: function (animationName, args, duration, delay, onAnimate) {

        var scope = this;

        this.orbit_controls.focus2(
            args,
            function (name, arguments, callback, callbackEnd) {

                scope.animateParamTo(animationName, arguments, duration, delay, null, callback, callbackEnd);
            },
            onAnimate);

    },

    disposeWebGL : function () {

        var scope = this;

        this.clearScene( this.sc.scene, this.camera );

        this.animationHelper.dispose();

        this.interfaces.map( function ( object ) {

            scope.clearScene( object.scene, object.camera, object.renderer );

        } );

        for ( var key in this.sc.cameras ) {
            var camera = this.sc.cameras[ key ];
            scope.clearScene( camera );
            if ( camera.parent ) {
                camera.parent.remove( camera );
            } else {
                this.sc.cameras[ key ] = null;
            }
        }

        for ( var key in this.sc.empties ) {
            var object = this.sc.empties[ key ];
            scope.clearScene( object );
            if ( object.parent ) {
                object.parent.remove( object );
            } else {
                this.sc.empties[ key ] = null;
            }
        }

        for ( var key in this.sc.geometries ) {
            var geometry = this.sc.geometries[ key ];
            geometry.dispose();
            this.sc.geometries[ key ] = null;
        }

        for ( var key in this.sc.lights ) {
            var light = this.sc.lights[ key ];
            if ( light.parent ) {
                light.parent.remove( light );
            } else {
                this.sc.lights[ key ] = null;
            }
        }

        for ( var key in this.sc.materials ) {
            var material = this.sc.materials[ key ];
            if ( material instanceof THREE.MultiMaterial ) {

                for ( var i = 0; i < material.materials.length; i++ ) {
                    material.materials[ i ].dispose();
                }

            } else {
                material.dispose();
            }
            this.sc.materials[ key ] = null
        }

        for ( var key in this.sc.objects ) {
            var object = this.sc.objects[ key ];
            scope.clearScene( object );
            if ( object.parent ) {
                object.parent.remove( object );
            } else {
                this.sc.objects[ key ] = null;
            }
        }

        for ( var key in this.sc.textures ) {
            var texture = this.sc.textures[ key ];
            texture.dispose();
            this.sc.textures[ key ] = null;
        }

        this.orbit_controls.dispose();
        this.orbit_controls = null;

        this.sc.scene = null;

        this.renderer.dispose();
        this.requestRender();

        setTimeout(function (){
            scope.renderer = null;
        },0)

    },

    clearScene : function ( scene, camera, renderer ) {

        var objects = scene.children;

        while ( objects.length > 0 ) {

            removeObject( objects[ 0 ] );

        }

        function removeObject ( object ) {


            object.traverse( function ( child ) {

                if ( child.dispose ) child.dispose();
                if ( child.material ) {
                    if ( child.material instanceof THREE.MultiMaterial ) {

                        for ( var i = 0; i < child.material.materials.length; i++ ) {
                            child.material.materials[ i ].dispose();
                        }

                    } else {
                        child.material.dispose();
                    }

                }
                if ( child.geometry ) child.geometry.dispose();

            } );

            object.parent.remove( object );
            if ( object.dispose ) object.dispose();
            if ( object.material ){
                if ( object.material instanceof THREE.MultiMaterial ) {

                    for ( var i = 0; i < object.material.materials.length; i++ ) {
                        object.material.materials[ i ].dispose();
                    }

                } else {
                    object.material.dispose();
                }
            }
            if ( object.geometry ) object.geometry.dispose();
        }

        if ( scene ) scene = null;
        if ( camera ) camera = null;
        if ( renderer ) {
            renderer.dispose();
            renderer = null;
        }

    },


    animate_simple: function(t) {
        var _this = this;
        requestAnimationFrame(function(t){ _this.animate_simple(t) }, this.renderer.domElement);

        this.processAnimations();

    },

    animate: function (t) {

        if (this.renderer == null) {
            cancelAnimationFrame(this.requestAnimate);
            return;
        }

        var _this = this;
        this.requestAnimate = requestAnimationFrame(function (t) {
            _this.animate(t)
        }, this.renderer.domElement);

        this.processAnimations2();

        if (this.orbit_controls) {
            this.orbit_controls.update();
        }

        if (this.needRender || this.options.always_render) {
            this.render(t);
            this.needRender = false;
        }

        if (this.options.stats)
            this.stats.update();

    },


    processAnimations: function () {
        for (var name in this.animations) {
            var anim = this.animations[name],
                obj = anim.obj,
                timer = (+new Date) - anim.started;

            for (var param in anim.start) {
                var start_val = anim.start[param],
                    delta = anim.delta[param],
                    new_val = anim.easing(timer, start_val, delta, anim.duration);

                obj[param] = new_val;

                if (obj == this.camera) {
                    this.camera.updateProjectionMatrix();
                }
            }

            if (name == 'cam switch') {
                this.camera.lookAt(this.scene.position);
            }

            if (timer > anim.duration) {
                //                    this.log('anim stop', name, new_val);
                if (anim.callback) {
                    anim.callback.call(this, obj);
                }

                delete this.animations[name];
            }

            this.requestRender();
        }
    },

    processAnimations2: function () {

        var event = false;

        for (var name in this.animations) {

            var anim = this.animations[name],
                arguments = anim.args,
                timer = (+new Date) - anim.started;

            if (anim.started > (+new Date))
                continue;

            if (anim.easing && anim.easing != null)
                for (var argument in arguments) {

                    var start = arguments[argument].start;
                    var delta = arguments[argument].delta;

                    if (arguments[argument].obj instanceof Object) {

                        for (var param in start) {
                            var startValue = start[param],
                                deltaValue = delta[param],
                                newValue = anim.easing(timer, startValue, deltaValue, anim.duration);

                            arguments[argument].obj[param] = newValue;
                        }

                    } else {

                        var newValue = anim.easing(timer, start, delta, anim.duration);
                        arguments[argument].obj = newValue;
                    }

                }

            if (anim.callback) {

                anim.callback.call(this, arguments);
            }

            if (timer > anim.duration) {

                if (anim.callbackEnd) {
                    anim.callbackEnd.call(this, arguments);
                }
                delete this.animations[name];

            }

            event = true;
        }

        if (Object.keys(this.autorotations).length > 0) {

            var delta = this.clock.getDelta();

            for (var key in this.autorotations) {

                var object = this.autorotations[key];
                if (object.userData.autorotation.enabled) {

                    for (var axis in object.userData.autorotation.speed) {

                        object.rotation[axis] += object.userData.autorotation.speed[axis] * delta;

                    }
                    event = true;
                }
            }

        }
        if (event)
            this.requestRender();
    },


    render : function ( t ) {

		ion.scene.getObjectByName('sky').material.uniforms[ 'sunPosition' ].value = ion.scene.getObjectByName('sunLight').position;
		ion.scene.getObjectByName('cubeCamera').update( ion.renderer, ion.scene.getObjectByName('sky') );

        this.renderer.clear();
        this.renderer.render( this.scene, this.camera );

		var time = performance.now() * 0.001;
		if (ion.data.param.live_data.current.wind_kph >= 10) {
			var speed = ion.data.param.live_data.current.wind_kph/8;
		} else  {
			var speed = 1;
		}
		this.sc.objects.main_group.getObjectByName('water').material.uniforms[ 'time' ].value += (speed) / 100;

        for ( var i = 0, j = this.interfaces.length; i < j; i++ ) {
            this.interfaces[ i ].renderer.clear();
            this.interfaces[ i ].renderer.render( this.interfaces[ i ].scene, this.interfaces[ i ].camera );
        }

        if ( this.options.camera_info ) this.showCamInfo();
        if ( this.options.weather_info ) this.showLiveWeather();
    },

	fetchWeather : function () {

		var today = new Date();
		var dd = String(today.getDate()).padStart(2, '0');
		var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
		var yyyy = today.getFullYear();

		var todayAstro = 'http://api.weatherapi.com/v1/astronomy.json?key=86e2cee98e40449a969174824200812&q=47.7086, -52.7144&dt=' + yyyy + '-' + mm + '-' + dd;
		console.log(todayAstro);


		fetch('http://api.weatherapi.com/v1/current.json?key=86e2cee98e40449a969174824200812&q=47.7086, -52.7144').then(res => res.json()).then(data => ion.data.param.live_data = data);
		// fetch(todayAstro).then(res => res.json()).then(data => ion.data.param.live_astro = data);

		setTimeout(stepOne, 3000);
		setTimeout(stepTwo, 300000);

		function stepOne() {
			ion.updateWeather();
			ion.updateSun();

			// if ( ion.options.weather_info !== false && undefined ) {
				// ion.showLiveWeather();
			// }

		}

		function stepTwo() {
			ion.fetchWeather();
		}

	},

	updateWeather : function() {
		var wind = ( ion.data.param.live_data.current.wind_degree / 57.325 );
		var windSpeed = ( (ion.data.param.live_data.current.wind_kph / 57.325)/2 );
		var swivMult = ion.data.param.swiv_factor;
		if (ion.data.param.live_data.current.wind_degree < 45 || ion.data.param.live_data.current.wind_degree > 315 && ion.data.param.live_data.current.wind_kph <= 80 ) {
			var speedFov = ( 35 + ion.data.param.live_data.current.wind_kph / 1.66 );
			ion.setFov(speedFov);
		} else if (ion.data.param.live_data.current.wind_degree < 45 || ion.data.param.live_data.current.wind_degree > 315 && ion.data.param.live_data.current.wind_kph > 80 ) {
			ion.setFov(speedFov);
		} else {
			ion.setFov(45);
		}
		var stepDuration = 300000/((ion.data.param.live_data.current.wind_kph/100)+1);
		var randomSeed = 3;

		//ion.sc.objects.house.rotation.z = wind;
		if (ion.data.param.live_data.current.wind_degree !== ion.data_stored.param.live_data.current.wind_degree) {
			ion.animateParamToSMP3('rotate_house', ion.sc.objects.h1_group.rotation, { x: 0, y: 0, z: wind }, 300000, easeInOutCubic);
			ion.data_stored.param.live_data.current.wind_degree = ion.data.param.live_data.current.wind_degree;
			console.log('rotate house to win direction');
		} else {

			setTimeout(stepOne, 0);
			setTimeout(stepTwo, stepDuration);

			function stepOne() {
			var valRandom1 = round ((((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1)+1*swivMult), 100);
			var Z = round(wind + (windSpeed*valRandom1), 100);
			console.log('step one: ', valRandom1, "angle: ", Z, round((Z * 57.325), 1), '°' );
			ion.animateParamToSMP3('rotate_house', ion.sc.objects.h1_group.rotation, { x: 0, y: 0, z: Z }, stepDuration, easeInOutSine);
			}

			function stepTwo() {
			var valRandom1 = round ((((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1)+1*swivMult), 100);
			var Z = round(wind - (windSpeed*valRandom1), 100);
			console.log('step two: ', valRandom1, "angle: ", Z, round((Z * 57.325), 1), '°' );
			ion.animateParamToSMP3('rotate_house', ion.sc.objects.h1_group.rotation, { x: 0, y: 0, z: Z }, stepDuration, easeInOutSine);
			}
		}


	},

	animateHouse : function() {

		var wind = ion.data.param.live_data.current.wind_kph;

		if (wind <= 9) {
			var stepDuration = 5000;
			//this.log('wind 0');
		} else if (wind <= 29) {
			var stepDuration = 4500;
			//this.log('wind 10 29');
		} else if (wind <= 39 ) {
			var stepDuration = 4000;
			//this.log('wind 30 39');
		} else if (wind <= 49 ) {
			var stepDuration = 3500;
			//this.log('wind 40 49');
		} else if (wind <= 59 ) {
			var stepDuration = 3000;
			//this.log('wind 50 59');
		} else if (wind <= 79 ) {
			var stepDuration = 3000;
			//this.log('wind 60 79');
		} else if (wind <= 80 ) {
			var stepDuration = 2800;
			//this.log('wind 80');
		} else {
			//this.log('wind 90');

		}

		var randomSeed = 3;

		var posMult = ion.data.param.wind_factor +(wind/20);
		var rotMult = ion.data.param.wind_factor +ion.data.param.sway_factor +(wind/20);
		var swivMult = ion.data.param.swiv_factor +(wind/20);

		setTimeout(stepOne, 0);
		setTimeout(stepTwo, stepDuration);
		setTimeout(stepThree, stepDuration*2);
		setTimeout(stepFour, stepDuration*3);

		function stepOne() {
			var valRandom1 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom2 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom3 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			// console.log('random:', valRandom)
			ion.animateParamToSMP4('rocking_position', ion.sc.objects.h2_group.position, { /*x: 0.0,*/ y: 0.1*posMult*valRandom1, z: 0.1*posMult*valRandom2 }, stepDuration, easeInOutSine);
			ion.animateParamToSMP2('rocking_rotation', ion.sc.objects.h3_group.rotation, { x: 0.0005*rotMult*valRandom3, y: 0.002*rotMult*valRandom2/*, z: round(-0.004*swivMult*valRandom1, 10000)*/  }, stepDuration, easeInOutSine);
			//console.log('new sequence', swivMult, round(-0.004*swivMult*valRandom1, 10000));
		}

		function stepTwo() {
			var valRandom1 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom2 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom3 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			ion.animateParamToSMP4('rocking_position', ion.sc.objects.h2_group.position, { /*x: -0.0*posMult, */ y: 0, z: -0.2*posMult*valRandom1 }, stepDuration, easeInOutSine);
		ion.animateParamToSMP2('rocking_rotation', ion.sc.objects.h3_group.rotation, { x: -0.0005*rotMult*valRandom2, y: -0.002*rotMult*valRandom1/*, z: round(0.005*swivMult*valRandom3, 10000)*/ }, stepDuration, easeInOutSine);
			//console.log('new sequence', swivMult, round(0.005*swivMult*valRandom3, 10000));
		}

		function stepThree() {
			var valRandom1 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom2 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom3 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			ion.animateParamToSMP4('rocking_position', ion.sc.objects.h2_group.position, { /*x: 0.0,*/ y: 0.1*posMult*valRandom1, z: 0.1*posMult*valRandom2 }, stepDuration, easeInOutSine);
		ion.animateParamToSMP2('rocking_rotation', ion.sc.objects.h3_group.rotation, { x: 0.0005*rotMult*valRandom3, y: 0.002*rotMult*valRandom2/*, z: round(-0.004*swivMult*valRandom2, 10000)*/ }, stepDuration, easeInOutSine);
			//console.log('new sequence', swivMult, round(-0.004*swivMult*valRandom2, 10000));

		}

		function stepFour() {
			var valRandom1 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom2 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			var valRandom3 = round (((Math.random() * (randomSeed - (-randomSeed)) + randomSeed)*0.1), 100)+0.5;
			ion.animateParamToSMP4('rocking_position', ion.sc.objects.h2_group.position, { /*x: -0.0*posMult, */ y: 0, z: -0.2*posMult*valRandom1 }, stepDuration, easeInOutSine);
		ion.animateParamToSMP2('rocking_rotation', ion.sc.objects.h3_group.rotation, { x: -0.0005*rotMult*valRandom2, y: -0.002*rotMult*valRandom1/*, z: round(0.005*swivMult*valRandom3, 10000)*/ }, stepDuration, easeInOutSine);

			if (ion.data.param.animation !== false) {
				setTimeout(ion.animateHouse, stepDuration);
				//console.log('new sequence', swivMult, round(0.005*swivMult*valRandom3, 10000));
			} else {}
		}

		/*

		{"position" : {"x": 0, "y": 1, "z": 0.5}, "rotation" : {"x": 0, "y": 0.01, "z": 0.02}},
		{"position" : {"x": 1, "y": 0, "z": -1}, "rotation" : {"x": 0.01, "y": 0.0, "z": -0.03}},
		{"position" : {"x": 0, "y": 1, "z": 0.5}, "rotation" : {"x": 0, "y": 0.02, "z": 0.01}},
		{"position" : {"x": 1, "y": 0, "z": -1}, "rotation" : {"x": 0.01, "y": -0.01, "z": -0.02}}

		*/

	},

	updateMaterial : function() {
		var opt = this.options;
		var url = "";
		// var url = opt.scene_assets_url + opt.woo_tex_url;
        var o = this.sc.objects;
		var mMat = this.data.param.mMat;
		var tex_loader = new THREE.TextureLoader();
		var pc = ion.data.param;
		var pcm = ion.data.param.materials;
		var st = ion.data_stored.param;
		var stm = ion.data_stored.param.materials;


		if (matNoo = 'mat_01', pcm[matNoo] != undefined || null)   {

			let matNo = matNoo;
			let matAr = matNo.substring(4,6);
			let pcMat = pcm[matNo];
			let stMat = stm[matNo];
			let arMat = ion.sc.materials.mm_procedural[matAr-1];
			let albedoTex = pcMat.map;
			let roughnessTex = pcMat.roughnessMap;
			let bumpTex = pcMat.bumpMap;

			if (albedoTex != undefined || null) {
				if (pcm[matNo].map != stm[matNo].map) {
					tex_loader.load(albedoTex,
						function (texture) {
						if (bumpTex == 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.bumpMap = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + 'for all');
						} else if (bumpTex == 'albedo' && roughnessTex !== 'albedo') {
							arMat.map = arMat.bumpMap = (texture);
							console.log('albedo' + matNo + '+ bump');
						} else if (bumpTex !== 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + '+ roughnessMap');
						} else {
							arMat.map = (texture);
							console.log('albedo' + matNo + 'just map');
						}
						texture.flipY = true;
						texture.anisotropy = 4;
						texture.repeat.set(pcMat.map_repeat, pcMat.map_repeat);
						texture.wrapS = texture.wrapT = 1000;
						stm[matNo].map = pcm[matNo].map;
						ion.requestRender();
					},
						function (xhr) {
						console.log((xhr.loaded / xhr.total * 100) + '% loaded');
					});
				} else {
					console.log('albedo_' + matNo + ' no change');
				}
			} else {
				console.log('albedo ' + matNo + ' null');
			}

			if (bumpTex != undefined || null) {
				if (pcm[matNo].bumpMap != stm[matNo].bumpMap) {
					if (bumpTex == 'albedo') {
						stm[matNo].bumpMap = pcm[matNo].bumpMap;
						console.log('bumpMap_' + matNo + ' //skipped');
					} else if (bumpTex.indexOf("jpg") !== -1 || bumpTex.indexOf("png") !== -1) {
						tex_loader.load(bumpTex,
							function (texture) {
							if (roughnessTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('bumpMap' + matNo + '+ roughnessMap');
							} else {
								arMat.bumpMap = (texture);
								console.log('bumpMap' + matNo + 'just bumpMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].bumpMap = pcm[matNo].bumpMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('bumpMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].bumpMap = pcm[matNo].bumpMap;
					console.log('bumpMap_' + matNo + ' no change');
				}
			} else {
				console.log('bumpMap_' + matNo + '//null');
			}

			if (roughnessTex != undefined || null) {
				if (pcm[matNo].roughnessMap != stm[matNo].roughnessMap) {
					if (roughnessTex == 'albedo' || roughnessTex == 'bumpMap') {
						stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
						console.log('roughnessMap_' + matNo + ' //skipped');
					} else if (roughnessTex.indexOf("jpg") !== -1 || roughnessTex.indexOf("png") !== -1) {
						tex_loader.load(roughnessTex,
							function (texture) {
							if (bumpTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + '+ bumpMap');
							} else {
								arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + 'just roughnessMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('roughnessMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
					console.log('roughnessMap_' + matNo + ' no change');
				}
			} else {
				console.log('roughnessMap_' + matNo + '//null');
			}


			if (pcMat.color != undefined || null ) {
				var h = pcMat.color.h;
				var s = pcMat.color.s;
				var l = pcMat.color.l;
				arMat.color.setHSL(h,s,l) ;
			} else {
				arMat.color.setHSL(0,0,0.5) ;
			}

			if ( bumpTex != null && pcMat.bumpScale != undefined || null) {
				arMat.bumpScale = pcMat.bumpScale;
			} else {
				arMat.bumpScale = 0;
			}

			if (pcMat.envMapIntensity != undefined || null ) {
				arMat.envMapIntensity = pcMat.envMapIntensity;
			} else {
				arMat.envMapIntensity = 1;
			}

			if (pcMat.metalness != undefined || null ) {
				arMat.metalness = pcMat.metalness;
			} else {
				arMat.metalness = 0;
			}

			if (pcMat.roughness != undefined || null ) {
				arMat.roughness = pcMat.roughness;
			} else {
				arMat.roughness = 0.5;
			}

			if (arMat.type == "MeshPhysicalMaterial" ) {
				if (pcMat.clearCoat != undefined || null ) {
					arMat.clearCoat = pcMat.clearCoat;
				} else {
					arMat.clearCoat = 0;
				}

				if (pcMat.clearCoatRoughness != undefined || null ) {
					arMat.clearCoatRoughness = pcMat.clearCoatRoughness;
				} else {
					arMat.clearCoatRoughness = 0;
				}

				if (pcMat.reflectivity != undefined || null ) {
					arMat.reflectivity = pcMat.reflectivity;
				} else {
					arMat.reflectivity = 0.5;
				}
			} else {
			}

			this.applyMaterials();
			this.requestRender();

		} else {
		}


		if (matNoo = 'mat_02', pcm[matNoo] != undefined || null)   {

			let matNo = matNoo;
			let matAr = matNo.substring(4,6);
			let pcMat = pcm[matNo];
			let stMat = stm[matNo];
			let arMat = ion.sc.materials.mm_procedural[matAr-1];
			let albedoTex = pcMat.map;
			let roughnessTex = pcMat.roughnessMap;
			let bumpTex = pcMat.bumpMap;

			if (albedoTex != undefined || null) {
				if (pcm[matNo].map != stm[matNo].map) {
					tex_loader.load(albedoTex,
						function (texture) {
						if (bumpTex == 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.bumpMap = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + 'for all');
						} else if (bumpTex == 'albedo' && roughnessTex !== 'albedo') {
							arMat.map = arMat.bumpMap = (texture);
							console.log('albedo' + matNo + '+ bump');
						} else if (bumpTex !== 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + '+ roughnessMap');
						} else {
							arMat.map = (texture);
							console.log('albedo' + matNo + 'just map');
						}
						texture.flipY = true;
						texture.anisotropy = 4;
						texture.repeat.set(pcMat.map_repeat, pcMat.map_repeat);
						texture.wrapS = texture.wrapT = 1000;
						stm[matNo].map = pcm[matNo].map;
						ion.requestRender();
					},
						function (xhr) {
						console.log((xhr.loaded / xhr.total * 100) + '% loaded');
					});
				} else {
					console.log('albedo_' + matNo + ' no change');
				}
			} else {
				console.log('albedo ' + matNo + ' null');
			}

			if (bumpTex != undefined || null) {
				if (pcm[matNo].bumpMap != stm[matNo].bumpMap) {
					if (bumpTex == 'albedo') {
						stm[matNo].bumpMap = pcm[matNo].bumpMap;
						console.log('bumpMap_' + matNo + ' //skipped');
					} else if (bumpTex.indexOf("jpg") !== -1 || bumpTex.indexOf("png") !== -1) {
						tex_loader.load(bumpTex,
							function (texture) {
							if (roughnessTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('bumpMap' + matNo + '+ roughnessMap');
							} else {
								arMat.bumpMap = (texture);
								console.log('bumpMap' + matNo + 'just bumpMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].bumpMap = pcm[matNo].bumpMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('bumpMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].bumpMap = pcm[matNo].bumpMap;
					console.log('bumpMap_' + matNo + ' no change');
				}
			} else {
				console.log('bumpMap_' + matNo + '//null');
			}

			if (roughnessTex != undefined || null) {
				if (pcm[matNo].roughnessMap != stm[matNo].roughnessMap) {
					if (roughnessTex == 'albedo' || roughnessTex == 'bumpMap') {
						stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
						console.log('roughnessMap_' + matNo + ' //skipped');
					} else if (roughnessTex.indexOf("jpg") !== -1 || roughnessTex.indexOf("png") !== -1) {
						tex_loader.load(roughnessTex,
							function (texture) {
							if (bumpTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + '+ bumpMap');
							} else {
								arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + 'just roughnessMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('roughnessMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
					console.log('roughnessMap_' + matNo + ' no change');
				}
			} else {
				console.log('roughnessMap_' + matNo + '//null');
			}


			if (pcMat.color != undefined || null ) {
				var h = pcMat.color.h;
				var s = pcMat.color.s;
				var l = pcMat.color.l;
				arMat.color.setHSL(h,s,l) ;
			} else {
				arMat.color.setHSL(0,0,0.5) ;
			}

			if ( bumpTex != null && pcMat.bumpScale != undefined || null) {
				arMat.bumpScale = pcMat.bumpScale;
			} else {
				arMat.bumpScale = 0;
			}

			if (pcMat.envMapIntensity != undefined || null ) {
				arMat.envMapIntensity = pcMat.envMapIntensity;
			} else {
				arMat.envMapIntensity = 1;
			}

			if (pcMat.metalness != undefined || null ) {
				arMat.metalness = pcMat.metalness;
			} else {
				arMat.metalness = 0;
			}

			if (pcMat.roughness != undefined || null ) {
				arMat.roughness = pcMat.roughness;
			} else {
				arMat.roughness = 0.5;
			}

			if (arMat.type == "MeshPhysicalMaterial" ) {
				if (pcMat.clearCoat != undefined || null ) {
					arMat.clearCoat = pcMat.clearCoat;
				} else {
					arMat.clearCoat = 0;
				}

				if (pcMat.clearCoatRoughness != undefined || null ) {
					arMat.clearCoatRoughness = pcMat.clearCoatRoughness;
				} else {
					arMat.clearCoatRoughness = 0;
				}

				if (pcMat.reflectivity != undefined || null ) {
					arMat.reflectivity = pcMat.reflectivity;
				} else {
					arMat.reflectivity = 0.5;
				}
			} else {
			}

			this.applyMaterials();
			this.requestRender();

		} else {
		}


		if (matNoo = 'mat_03', pcm[matNoo] != undefined || null)   {

			let matNo = matNoo;
			let matAr = matNo.substring(4,6);
			let pcMat = pcm[matNo];
			let stMat = stm[matNo];
			let arMat = ion.sc.materials.mm_procedural[matAr-1];
			let albedoTex = pcMat.map;
			let roughnessTex = pcMat.roughnessMap;
			let bumpTex = pcMat.bumpMap;

			if (albedoTex != undefined || null) {
				if (pcm[matNo].map != stm[matNo].map) {
					tex_loader.load(albedoTex,
						function (texture) {
						if (bumpTex == 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.bumpMap = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + 'for all');
						} else if (bumpTex == 'albedo' && roughnessTex !== 'albedo') {
							arMat.map = arMat.bumpMap = (texture);
							console.log('albedo' + matNo + '+ bump');
						} else if (bumpTex !== 'albedo' && roughnessTex == 'albedo') {
							arMat.map = arMat.roughnessMap = (texture);
							console.log('albedo' + matNo + '+ roughnessMap');
						} else {
							arMat.map = (texture);
							console.log('albedo' + matNo + 'just map');
						}
						texture.flipY = true;
						texture.anisotropy = 4;
						texture.repeat.set(pcMat.map_repeat, pcMat.map_repeat);
						texture.wrapS = texture.wrapT = 1000;
						stm[matNo].map = pcm[matNo].map;
						ion.requestRender();
					},
						function (xhr) {
						console.log((xhr.loaded / xhr.total * 100) + '% loaded');
					});
				} else {
					console.log('albedo_' + matNo + ' no change');
				}
			} else {
				console.log('albedo ' + matNo + ' null');
			}

			if (bumpTex != undefined || null) {
				if (pcm[matNo].bumpMap != stm[matNo].bumpMap) {
					if (bumpTex == 'albedo') {
						stm[matNo].bumpMap = pcm[matNo].bumpMap;
						console.log('bumpMap_' + matNo + ' //skipped');
					} else if (bumpTex.indexOf("jpg") !== -1 || bumpTex.indexOf("png") !== -1) {
						tex_loader.load(bumpTex,
							function (texture) {
							if (roughnessTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('bumpMap' + matNo + '+ roughnessMap');
							} else {
								arMat.bumpMap = (texture);
								console.log('bumpMap' + matNo + 'just bumpMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].bumpMap = pcm[matNo].bumpMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('bumpMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].bumpMap = pcm[matNo].bumpMap;
					console.log('bumpMap_' + matNo + ' no change');
				}
			} else {
				console.log('bumpMap_' + matNo + '//null');
			}

			if (roughnessTex != undefined || null) {
				if (pcm[matNo].roughnessMap != stm[matNo].roughnessMap) {
					if (roughnessTex == 'albedo' || roughnessTex == 'bumpMap') {
						stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
						console.log('roughnessMap_' + matNo + ' //skipped');
					} else if (roughnessTex.indexOf("jpg") !== -1 || roughnessTex.indexOf("png") !== -1) {
						tex_loader.load(roughnessTex,
							function (texture) {
							if (bumpTex == 'bumpMap') {
								arMat.bumpMap = arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + '+ bumpMap');
							} else {
								arMat.roughnessMap = (texture);
								console.log('roughnessMap' + matNo + 'just roughnessMap');
							}
							texture.flipY = true;
							texture.anisotropy = 4;
							texture.repeat.set(pcMat.bumpMap_repeat, pcMat.bumpMap_repeat);
							texture.wrapS = texture.wrapT = 1000;
							stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
							ion.requestRender();
						},
							function (xhr) {
							console.log((xhr.loaded / xhr.total * 100) + '% loaded');
						})
					} else {
						console.log('roughnessMap_' + matNo + '//strange case');
					}
				} else {
					stm[matNo].roughnessMap = pcm[matNo].roughnessMap;
					console.log('roughnessMap_' + matNo + ' no change');
				}
			} else {
				console.log('roughnessMap_' + matNo + '//null');
			}


			if (pcMat.color != undefined || null ) {
				var h = pcMat.color.h;
				var s = pcMat.color.s;
				var l = pcMat.color.l;
				arMat.color.setHSL(h,s,l) ;
			} else {
				arMat.color.setHSL(0,0,0.5) ;
			}

			if ( bumpTex != null && pcMat.bumpScale != undefined || null) {
				arMat.bumpScale = pcMat.bumpScale;
			} else {
				arMat.bumpScale = 0;
			}

			if (pcMat.envMapIntensity != undefined || null ) {
				arMat.envMapIntensity = pcMat.envMapIntensity;
			} else {
				arMat.envMapIntensity = 1;
			}

			if (pcMat.metalness != undefined || null ) {
				arMat.metalness = pcMat.metalness;
			} else {
				arMat.metalness = 0;
			}

			if (pcMat.roughness != undefined || null ) {
				arMat.roughness = pcMat.roughness;
			} else {
				arMat.roughness = 0.5;
			}

			if (arMat.type == "MeshPhysicalMaterial" ) {
				if (pcMat.clearCoat != undefined || null ) {
					arMat.clearCoat = pcMat.clearCoat;
				} else {
					arMat.clearCoat = 0;
				}

				if (pcMat.clearCoatRoughness != undefined || null ) {
					arMat.clearCoatRoughness = pcMat.clearCoatRoughness;
				} else {
					arMat.clearCoatRoughness = 0;
				}

				if (pcMat.reflectivity != undefined || null ) {
					arMat.reflectivity = pcMat.reflectivity;
				} else {
					arMat.reflectivity = 0.5;
				}
			} else {
			}

			this.applyMaterials();
			this.requestRender();

		} else {
		}

	},

	applyMaterials : function() {

        var o = this.sc.objects;
		// applies materials if replacement is needed

	},


	collectData: function() {
        var serials = this.ion.skus2,
            serialsByTypes = this.serialsByTypes = {};

        // serials
        for (var id in serials) {
            var model = serials[id];

            serialsByTypes[model.type] = serialsByTypes[model.type] || [];
            serialsByTypes[model.type].push({title: model.title || id, id: id});
        }
			// console.log("mat_name : " + mat_name);
			// console.log( "printout:" + JSON.stringify( this.viewer.mat_lib ) );
        }


};








































































/**
 * @author jbouny / https://github.com/jbouny
 *
 * Work based on :
 * @author Slayvin / http://slayvin.net : Flat mirror for three.js
 * @author Stemkoski / http://www.adelphi.edu/~stemkoski : An implementation of water shader based on the flat mirror
 * @author Jonas Wagner / http://29a.ch/ && http://29a.ch/slides/2012/webglwater/ : Water shader explanations in WebGL
 */

THREE.Water = function ( geometry, options ) {

	THREE.Mesh.call( this, geometry );

	var scope = this;

	options = options || {};

	var textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
	var textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;

	var clipBias = options.clipBias !== undefined ? options.clipBias : 0.0;
	var alpha = options.alpha !== undefined ? options.alpha : 1.0;
	var time = options.time !== undefined ? options.time : 0.0;
	var normalSampler = options.waterNormals !== undefined ? options.waterNormals : null;
	var sunDirection = options.sunDirection !== undefined ? options.sunDirection : new THREE.Vector3( 0.70707, 0.70707, 0.0 );
	var sunColor = new THREE.Color( options.sunColor !== undefined ? options.sunColor : 0xffffff );
	var waterColor = new THREE.Color( options.waterColor !== undefined ? options.waterColor : 0x7F7F7F );
	var eye = options.eye !== undefined ? options.eye : new THREE.Vector3( 0, 0, 0 );
	var distortionScale = options.distortionScale !== undefined ? options.distortionScale : 20.0;
	var side = options.side !== undefined ? options.side : THREE.FrontSide;
	var fog = options.fog !== undefined ? options.fog : false;

	//

	var mirrorPlane = new THREE.Plane();
	var normal = new THREE.Vector3();
	var mirrorWorldPosition = new THREE.Vector3();
	var cameraWorldPosition = new THREE.Vector3();
	var rotationMatrix = new THREE.Matrix4();
	var lookAtPosition = new THREE.Vector3( 0, 0, - 1 );
	var clipPlane = new THREE.Vector4();

	var view = new THREE.Vector3();
	var target = new THREE.Vector3();
	var q = new THREE.Vector4();

	var textureMatrix = new THREE.Matrix4();

	var mirrorCamera = new THREE.PerspectiveCamera();

	var parameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};

	var renderTarget = new THREE.WebGLRenderTarget( textureWidth, textureHeight, parameters );

	if ( ! THREE.Math.isPowerOfTwo( textureWidth ) || ! THREE.Math.isPowerOfTwo( textureHeight ) ) {

		renderTarget.texture.generateMipmaps = false;

	}

	var mirrorShader = {

		uniforms: THREE.UniformsUtils.merge( [
			THREE.UniformsLib[ 'fog' ],
			THREE.UniformsLib[ 'lights' ],
			{
				"normalSampler": { value: null },
				"mirrorSampler": { value: null },
				"alpha": { value: 0.7 },
				"time": { value: 0.0 },
				"size": { value: 8.0 },
				"distortionScale": { value: 20.0 },
				"textureMatrix": { value: new THREE.Matrix4() },
				"sunColor": { value: new THREE.Color( 0x7F7F7F ) },
				"sunDirection": { value: new THREE.Vector3( 0.70707, 0.70707, 0 ) },
				"eye": { value: new THREE.Vector3() },
				"waterColor": { value: new THREE.Color( 0x555555 ) }
			}
		] ),

		vertexShader: [
			'uniform mat4 textureMatrix;',
			'uniform float time;',

			'varying vec4 mirrorCoord;',
			'varying vec4 worldPosition;',

			THREE.ShaderChunk[ 'fog_pars_vertex' ],
			THREE.ShaderChunk[ 'shadowmap_pars_vertex' ],

			'void main() {',
			'	mirrorCoord = modelMatrix * vec4( position, 1.0 );',
			'	worldPosition = mirrorCoord.xyzw;',
			'	mirrorCoord = textureMatrix * mirrorCoord;',
			'	vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
			'	gl_Position = projectionMatrix * mvPosition;',

			THREE.ShaderChunk[ 'fog_vertex' ],
			THREE.ShaderChunk[ 'shadowmap_vertex' ],

			'}'
		].join( '\n' ),

		fragmentShader: [
			'uniform sampler2D mirrorSampler;',
			'uniform float alpha;',
			'uniform float time;',
			'uniform float size;',
			'uniform float distortionScale;',
			'uniform sampler2D normalSampler;',
			'uniform vec3 sunColor;',
			'uniform vec3 sunDirection;',
			'uniform vec3 eye;',
			'uniform vec3 waterColor;',

			'varying vec4 mirrorCoord;',
			'varying vec4 worldPosition;',

			'vec4 getNoise( vec2 uv ) {',
			'	vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);',
			'	vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );',
			'	vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );',
			'	vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );',
			'	vec4 noise = texture2D( normalSampler, uv0 ) +',
			'		texture2D( normalSampler, uv1 ) +',
			'		texture2D( normalSampler, uv2 ) +',
			'		texture2D( normalSampler, uv3 );',
			'	return noise * 0.5 - 1.0;',
			'}',

			'void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {',
			'	vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );',
			'	float direction = max( 0.0, dot( eyeDirection, reflection ) );',
			'	specularColor += pow( direction, shiny ) * sunColor * spec;',
			'	diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;',
			'}',

			THREE.ShaderChunk[ 'common' ],
			THREE.ShaderChunk[ 'packing' ],
			THREE.ShaderChunk[ 'bsdfs' ],
			THREE.ShaderChunk[ 'fog_pars_fragment' ],
			THREE.ShaderChunk[ 'lights_pars_begin' ],
			THREE.ShaderChunk[ 'shadowmap_pars_fragment' ],
			THREE.ShaderChunk[ 'shadowmask_pars_fragment' ],

			'void main() {',
			'	vec4 noise = getNoise( worldPosition.xz * size );',
			'	vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',

			'	vec3 diffuseLight = vec3(0.0);',
			'	vec3 specularLight = vec3(0.0);',

			'	vec3 worldToEye = eye-worldPosition.xyz;',
			'	vec3 eyeDirection = normalize( worldToEye );',
			'	sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );',

			'	float distance = length(worldToEye);',

			'	vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;',
			'	vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );',

			'	float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );',
			'	float rf0 = 0.3;',
			'	float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );',
			'	vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;',
			'	vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);',
			'	vec3 outgoingLight = albedo;',
			'	gl_FragColor = vec4( outgoingLight, alpha );',

			THREE.ShaderChunk[ 'tonemapping_fragment' ],
			THREE.ShaderChunk[ 'fog_fragment' ],

			'}'
		].join( '\n' )

	};

	var material = new THREE.ShaderMaterial( {
		fragmentShader: mirrorShader.fragmentShader,
		vertexShader: mirrorShader.vertexShader,
		uniforms: THREE.UniformsUtils.clone( mirrorShader.uniforms ),
		transparent: true,
		lights: true,
		side: side,
		fog: fog
	} );

	material.uniforms[ "mirrorSampler" ].value = renderTarget.texture;
	material.uniforms[ "textureMatrix" ].value = textureMatrix;
	material.uniforms[ "alpha" ].value = alpha;
	material.uniforms[ "time" ].value = time;
	material.uniforms[ "normalSampler" ].value = normalSampler;
	material.uniforms[ "sunColor" ].value = sunColor;
	material.uniforms[ "waterColor" ].value = waterColor;
	material.uniforms[ "sunDirection" ].value = sunDirection;
	material.uniforms[ "distortionScale" ].value = distortionScale;

	material.uniforms[ "eye" ].value = eye;

	scope.material = material;

	scope.onBeforeRender = function ( renderer, scene, camera ) {

		mirrorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
		cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		rotationMatrix.extractRotation( scope.matrixWorld );

		normal.set( 0, 0, 1 );
		normal.applyMatrix4( rotationMatrix );

		view.subVectors( mirrorWorldPosition, cameraWorldPosition );

		// Avoid rendering when mirror is facing away

		if ( view.dot( normal ) > 0 ) return;

		view.reflect( normal ).negate();
		view.add( mirrorWorldPosition );

		rotationMatrix.extractRotation( camera.matrixWorld );

		lookAtPosition.set( 0, 0, - 1 );
		lookAtPosition.applyMatrix4( rotationMatrix );
		lookAtPosition.add( cameraWorldPosition );

		target.subVectors( mirrorWorldPosition, lookAtPosition );
		target.reflect( normal ).negate();
		target.add( mirrorWorldPosition );

		mirrorCamera.position.copy( view );
		mirrorCamera.up.set( 0, 1, 0 );
		mirrorCamera.up.applyMatrix4( rotationMatrix );
		mirrorCamera.up.reflect( normal );
		mirrorCamera.lookAt( target );

		mirrorCamera.far = camera.far; // Used in WebGLBackground

		mirrorCamera.updateMatrixWorld();
		mirrorCamera.projectionMatrix.copy( camera.projectionMatrix );

		// Update the texture matrix
		textureMatrix.set(
			0.5, 0.0, 0.0, 0.5,
			0.0, 0.5, 0.0, 0.5,
			0.0, 0.0, 0.5, 0.5,
			0.0, 0.0, 0.0, 1.0
		);
		textureMatrix.multiply( mirrorCamera.projectionMatrix );
		textureMatrix.multiply( mirrorCamera.matrixWorldInverse );

		// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
		// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
		mirrorPlane.setFromNormalAndCoplanarPoint( normal, mirrorWorldPosition );
		mirrorPlane.applyMatrix4( mirrorCamera.matrixWorldInverse );

		clipPlane.set( mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant );

		var projectionMatrix = mirrorCamera.projectionMatrix;

		q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
		q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
		q.z = - 1.0;
		q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

		// Calculate the scaled plane vector
		clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

		// Replacing the third row of the projection matrix
		projectionMatrix.elements[ 2 ] = clipPlane.x;
		projectionMatrix.elements[ 6 ] = clipPlane.y;
		projectionMatrix.elements[ 10 ] = clipPlane.z + 1.0 - clipBias;
		projectionMatrix.elements[ 14 ] = clipPlane.w;

		eye.setFromMatrixPosition( camera.matrixWorld );

		//

		var currentRenderTarget = renderer.getRenderTarget();

		var currentVrEnabled = renderer.vr.enabled;
		var currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

		scope.visible = false;

		renderer.vr.enabled = false; // Avoid camera modification and recursion
		renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

		renderer.setRenderTarget( renderTarget );
		renderer.clear();
		renderer.render( scene, mirrorCamera );

		scope.visible = true;

		renderer.vr.enabled = currentVrEnabled;
		renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

		renderer.setRenderTarget( currentRenderTarget );

	};

};

THREE.Water.prototype = Object.create( THREE.Mesh.prototype );
THREE.Water.prototype.constructor = THREE.Water;



















































/**
 * @author zz85 / https://github.com/zz85
 *
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
*/

THREE.Sky = function () {

	var shader = THREE.Sky.SkyShader;

	var material = new THREE.ShaderMaterial( {
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
		side: THREE.BackSide
	} );

	THREE.Mesh.call( this, new THREE.BoxBufferGeometry( 1, 1, 1 ), material );

};

THREE.Sky.prototype = Object.create( THREE.Mesh.prototype );

THREE.Sky.SkyShader = {

	uniforms: {
		"luminance": { value: 1 },
		"turbidity": { value: 2 },
		"rayleigh": { value: 1 },
		"mieCoefficient": { value: 0.005 },
		"mieDirectionalG": { value: 0.8 },
		"sunPosition": { value: new THREE.Vector3() }
	},

	vertexShader: [
		'uniform vec3 sunPosition;',
		'uniform float rayleigh;',
		'uniform float turbidity;',
		'uniform float mieCoefficient;',

		'varying vec3 vWorldPosition;',
		'varying vec3 vSunDirection;',
		'varying float vSunfade;',
		'varying vec3 vBetaR;',
		'varying vec3 vBetaM;',
		'varying float vSunE;',

		'const vec3 up = vec3( 0.0, 1.0, 0.0 );',

		// constants for atmospheric scattering
		'const float e = 2.71828182845904523536028747135266249775724709369995957;',
		'const float pi = 3.141592653589793238462643383279502884197169;',

		// wavelength of used primaries, according to preetham
		'const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );',
		// this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		'const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );',

		// mie stuff
		// K coefficient for the primaries
		'const float v = 4.0;',
		'const vec3 K = vec3( 0.686, 0.678, 0.666 );',
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		'const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );',

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		'const float cutoffAngle = 1.6110731556870734;',
		'const float steepness = 1.5;',
		'const float EE = 1000.0;',

		'float sunIntensity( float zenithAngleCos ) {',
		'	zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );',
		'	return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );',
		'}',

		'vec3 totalMie( float T ) {',
		'	float c = ( 0.2 * T ) * 10E-18;',
		'	return 0.434 * c * MieConst;',
		'}',

		'void main() {',

		'	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
		'	vWorldPosition = worldPosition.xyz;',

		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
		'	gl_Position.z = gl_Position.w;', // set z to camera.far

		'	vSunDirection = normalize( sunPosition );',

		'	vSunE = sunIntensity( dot( vSunDirection, up ) );',

		'	vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );',

		'	float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );',

		// extinction (absorbtion + out scattering)
		// rayleigh coefficients
		'	vBetaR = totalRayleigh * rayleighCoefficient;',

		// mie coefficients
		'	vBetaM = totalMie( turbidity ) * mieCoefficient;',

		'}'
	].join( '\n' ),

	fragmentShader: [
		'varying vec3 vWorldPosition;',
		'varying vec3 vSunDirection;',
		'varying float vSunfade;',
		'varying vec3 vBetaR;',
		'varying vec3 vBetaM;',
		'varying float vSunE;',

		'uniform float luminance;',
		'uniform float mieDirectionalG;',

		'const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );',

		// constants for atmospheric scattering
		'const float pi = 3.141592653589793238462643383279502884197169;',

		'const float n = 1.0003;', // refractive index of air
		'const float N = 2.545E25;', // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		'const float rayleighZenithLength = 8.4E3;',
		'const float mieZenithLength = 1.25E3;',
		'const vec3 up = vec3( 0.0, 1.0, 0.0 );',
		// 66 arc seconds -> degrees, and the cosine of that
		'const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;',

		// 3.0 / ( 16.0 * pi )
		'const float THREE_OVER_SIXTEENPI = 0.05968310365946075;',
		// 1.0 / ( 4.0 * pi )
		'const float ONE_OVER_FOURPI = 0.07957747154594767;',

		'float rayleighPhase( float cosTheta ) {',
		'	return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );',
		'}',

		'float hgPhase( float cosTheta, float g ) {',
		'	float g2 = pow( g, 2.0 );',
		'	float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );',
		'	return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );',
		'}',

		// Filmic ToneMapping http://filmicgames.com/archives/75
		'const float A = 0.15;',
		'const float B = 0.50;',
		'const float C = 0.10;',
		'const float D = 0.20;',
		'const float E = 0.02;',
		'const float F = 0.30;',

		'const float whiteScale = 1.0748724675633854;', // 1.0 / Uncharted2Tonemap(1000.0)

		'vec3 Uncharted2Tonemap( vec3 x ) {',
		'	return ( ( x * ( A * x + C * B ) + D * E ) / ( x * ( A * x + B ) + D * F ) ) - E / F;',
		'}',


		'void main() {',
		// optical length
		// cutoff angle at 90 to avoid singularity in next formula.
		'	float zenithAngle = acos( max( 0.0, dot( up, normalize( vWorldPosition - cameraPos ) ) ) );',
		'	float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );',
		'	float sR = rayleighZenithLength * inverse;',
		'	float sM = mieZenithLength * inverse;',

		// combined extinction factor
		'	vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );',

		// in scattering
		'	float cosTheta = dot( normalize( vWorldPosition - cameraPos ), vSunDirection );',

		'	float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );',
		'	vec3 betaRTheta = vBetaR * rPhase;',

		'	float mPhase = hgPhase( cosTheta, mieDirectionalG );',
		'	vec3 betaMTheta = vBetaM * mPhase;',

		'	vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );',
		'	Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );',

		// nightsky
		'	vec3 direction = normalize( vWorldPosition - cameraPos );',
		'	float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]',
		'	float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]',
		'	vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );',
		'	vec3 L0 = vec3( 0.1 ) * Fex;',

		// composition + solar disc
		'	float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );',
		'	L0 += ( vSunE * 19000.0 * Fex ) * sundisk;',

		'	vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );',

		'	vec3 curr = Uncharted2Tonemap( ( log2( 2.0 / pow( luminance, 4.0 ) ) ) * texColor );',
		'	vec3 color = curr * whiteScale;',

		'	vec3 retColor = pow( color, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );',

		'	gl_FragColor = vec4( retColor, 1.0 );',

		'}'
	].join( '\n' )

};












































/**
 * @author alteredq / http://alteredqualia.com/
 * @author mr.doob / http://mrdoob.com/
 */

var WEBGL = {

	isWebGLAvailable: function () {

		try {

			var canvas = document.createElement( 'canvas' );
			return !! ( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );

		} catch ( e ) {

			return false;

		}

	},

	isWebGL2Available: function () {

		try {

			var canvas = document.createElement( 'canvas' );
			return !! ( window.WebGL2RenderingContext && canvas.getContext( 'webgl2' ) );

		} catch ( e ) {

			return false;

		}

	},

	getWebGLErrorMessage: function () {

		return this.getErrorMessage( 1 );

	},

	getWebGL2ErrorMessage: function () {

		return this.getErrorMessage( 2 );

	},

	getErrorMessage: function ( version ) {

		var names = {
			1: 'WebGL',
			2: 'WebGL 2'
		};

		var contexts = {
			1: window.WebGLRenderingContext,
			2: window.WebGL2RenderingContext
		};

		var message = 'Your $0 does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">$1</a>';

		var element = document.createElement( 'div' );
		element.id = 'webglmessage';
		element.style.fontFamily = 'monospace';
		element.style.fontSize = '13px';
		element.style.fontWeight = 'normal';
		element.style.textAlign = 'center';
		element.style.background = '#fff';
		element.style.color = '#000';
		element.style.padding = '1.5em';
		element.style.width = '400px';
		element.style.margin = '5em auto 0';

		if ( contexts[ version ] ) {

			message = message.replace( '$0', 'graphics card' );

		} else {

			message = message.replace( '$0', 'browser' );

		}

		message = message.replace( '$1', names[ version ] );

		element.innerHTML = message;

		return element;

	}

};
































/**
 * @author WestLangley / http://github.com/WestLangley
 */

THREE.LightProbeGenerator = {

	// https://www.ppsloan.org/publications/StupidSH36.pdf
	fromCubeTexture: function ( cubeTexture ) {

		var norm, lengthSq, weight, totalWeight = 0;

		var coord = new THREE.Vector3();

		var dir = new THREE.Vector3();

		var color = new THREE.Color();

		var shBasis = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

		var sh = new THREE.SphericalHarmonics3();
		var shCoefficients = sh.coefficients;

		for ( var faceIndex = 0; faceIndex < 6; faceIndex ++ ) {

			var image = cubeTexture.image[ faceIndex ];

			var width = image.width;
			var height = image.height;

			var canvas = document.createElement( 'canvas' );

			canvas.width = width;
			canvas.height = height;

			var context = canvas.getContext( '2d' );

			context.drawImage( image, 0, 0, width, height );

			var imageData = context.getImageData( 0, 0, width, height );

			var data = imageData.data;

			var imageWidth = imageData.width; // assumed to be square

			var pixelSize = 2 / imageWidth;

			for ( var i = 0, il = data.length; i < il; i += 4 ) { // RGBA assumed

				// pixel color
				color.setRGB( data[ i ] / 255, data[ i + 1 ] / 255, data[ i + 2 ] / 255 );

				// convert to linear color space
				color.copySRGBToLinear( color );

				// pixel coordinate on unit cube

				var pixelIndex = i / 4;

				var col = - 1 + ( pixelIndex % imageWidth + 0.5 ) * pixelSize;

				var row = 1 - ( Math.floor( pixelIndex / imageWidth ) + 0.5 ) * pixelSize;

				switch ( faceIndex ) {

					case 0: coord.set( - 1, row, - col ); break;

					case 1: coord.set( 1, row, col ); break;

					case 2: coord.set( - col, 1, - row ); break;

					case 3: coord.set( - col, - 1, row ); break;

					case 4: coord.set( - col, row, 1 ); break;

					case 5: coord.set( col, row, - 1 ); break;

				}

				// weight assigned to this pixel

				lengthSq = coord.lengthSq();

				weight = 4 / ( Math.sqrt( lengthSq ) * lengthSq );

				totalWeight += weight;

				// direction vector to this pixel
				dir.copy( coord ).normalize();

				// evaluate SH basis functions in direction dir
				THREE.SphericalHarmonics3.getBasisAt( dir, shBasis );

				// accummuulate
				for ( var j = 0; j < 9; j ++ ) {

					shCoefficients[ j ].x += shBasis[ j ] * color.r * weight;
					shCoefficients[ j ].y += shBasis[ j ] * color.g * weight;
					shCoefficients[ j ].z += shBasis[ j ] * color.b * weight;

				}

			}

		}

		// normalize
		norm = ( 4 * Math.PI ) / totalWeight;

		for ( var j = 0; j < 9; j ++ ) {

			shCoefficients[ j ].x *= norm;
			shCoefficients[ j ].y *= norm;
			shCoefficients[ j ].z *= norm;

		}

		return new THREE.LightProbe( sh );

	}

};
























































































































THREE.Preloader = function ( webglContainer, options ) {

	var camera, scene, renderer, request, container;

	this.start = function () {
		container.style.display = '';
		options.wrapper.style.display = 'block';
		if(request)
			cancelAnimationFrame( request );
		//animate();
		render();
	};

	this.stop = function () {
		cancelAnimationFrame( request );
		container.style.display = 'none';
		options.wrapper.style.display = "none";
	};

	this.updateProgress = function( progress ){

		var bar = (window.innerWidth * 0.33),
			total = progress.totalModels + progress.totalTextures,
			loaded = progress.loadedModels + progress.loadedTextures;

		if ( total )
			bar = Math.floor( bar * loaded / total );

		if(options.message)
			options.message.innerHTML = 'Loading... Models ' + progress.loadedModels + '/' + progress.totalModels + ', textures ' + progress.loadedTextures + '/' + progress.totalTextures;
		options.bar.style.width = bar + "px";
	};

	init();

	function init () {

		createLoadScene();

		renderer = new THREE.WebGLRenderer( { antialias : true, alpha : true } );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		//renderer.setClearColor( '#ffff00' );
		renderer.gammaInput = true;
		renderer.gammaOutput = true;
		document.body.insertBefore( renderer.domElement, options.wrapper );

		container = renderer.domElement;
		container.style.position = 'absolute';
		container.style.display = 'none';
		container.style.zIndex = 1006;
		container.style.top = container.style.left = 0;
		container.style.background = 'url(' + options.background +') no-repeat scroll center center';

		//

		window.addEventListener( 'resize', onWindowResize, false );

		setRelativeViewerContainer( );

	}

	function createLoadScene() {

		scene =  new THREE.Scene();
		camera = new THREE.PerspectiveCamera( 65, window.innerWidth / window.innerHeight, 1, 1000 );

		camera.position.z = 100;
		scene.add( camera );
/*
		var object, geometry, material, light, count = 500, range = 200;

		material = new THREE.MeshLambertMaterial( { color:0xffffff } );
		geometry = new THREE.BoxGeometry( 5, 5, 5 );

		for( var i = 0; i < count; i++ ) {

			object = new THREE.Mesh( geometry, material );

			object.position.x = ( Math.random() - 0.5 ) * range;
			object.position.y = ( Math.random() - 0.5 ) * range;
			object.position.z = ( Math.random() - 0.5 ) * range;

			object.rotation.x = Math.random() * 6;
			object.rotation.y = Math.random() * 6;
			object.rotation.z = Math.random() * 6;

			object.matrixAutoUpdate = false;
			object.updateMatrix();

			//scene.add( object );

		}
/*
		scene.matrixAutoUpdate = false;

		light = new THREE.PointLight( 0xffffff );
		scene.add( light );

		light = new THREE.DirectionalLight( 0x111111 );
		light.position.x = 1;
		scene.add( light );
*/
	}


	function onWindowResize () {

		setRelativeViewerContainer();


	}

	function setRelativeViewerContainer(){

		var width =  window.innerWidth;
		var height = window.innerHeight;

		camera.aspect = width/ height;
		camera.updateProjectionMatrix();

		renderer.setSize( width, height );

	}

	function animate () {
		request = requestAnimationFrame( animate );


		render();

	}

	function render(){
		renderer.clear();
		renderer.render( scene, camera );
	}


};
