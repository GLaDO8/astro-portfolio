import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { useSpringConfig } from "@/lib/spring-config";
import PostItNote from "./PostItNote";

// ── GLSL (WebGL 1, single texture sample per fragment) ──────────────

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_imageAspect;
uniform float u_cellSize;
uniform float u_dotSize;
uniform float u_softness;
uniform float u_contrast;
uniform float u_gridNoise;

// CMYK ink colors (from Paper design)
const vec3 INK_C = vec3(0.0, 0.706, 1.0);
const vec3 INK_M = vec3(0.988, 0.318, 0.624);
const vec3 INK_Y = vec3(1.0, 0.847, 0.0);
const vec3 INK_K = vec3(0.137, 0.122, 0.125);
const vec3 PAPER  = vec3(0.984, 0.98, 0.96);

// Classic CMYK screen angles (radians)
const float A_C = 0.2618;
const float A_M = 1.309;
const float A_Y = 0.0;
const float A_K = 0.7854;

// Per-channel gains & floods (from Paper)
const float G_C = 0.44;
const float G_M = 0.32;
const float G_Y = 0.29;
const float G_K = 0.0;
const float F_C = 0.15;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec4 toCMYK(vec3 rgb) {
  float k = 1.0 - max(rgb.r, max(rgb.g, rgb.b));
  float d = 1.0 / max(1.0 - k, 0.001);
  return vec4((1.0 - rgb.r - k) * d, (1.0 - rgb.g - k) * d, (1.0 - rgb.b - k) * d, k);
}

float channel(vec2 px, float angle, float ink, float gain, float flood) {
  float amount = clamp(ink * (1.0 + gain) + flood, 0.0, 1.0);
  vec2 r = rot(px, angle) / u_cellSize;
  vec2 cell = floor(r);
  vec2 local = fract(r) - 0.5;
  local += hash(cell) * u_gridNoise;
  float radius = sqrt(amount) * u_dotSize;
  float edge = u_softness * 0.15;
  return 1.0 - smoothstep(radius - edge, radius + edge, length(local));
}

void main() {
  // Cover-fit image UV
  float canvasAspect = u_resolution.x / u_resolution.y;
  vec2 uv = v_uv;
  if (canvasAspect > u_imageAspect) {
    uv.y = (uv.y - 0.5) * u_imageAspect / canvasAspect + 0.5;
  } else {
    uv.x = (uv.x - 0.5) * canvasAspect / u_imageAspect + 0.5;
  }
  uv.y = 1.0 - uv.y;

  vec3 color = texture2D(u_image, uv).rgb;
  color = clamp((color - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  vec4 cmyk = toCMYK(color);

  // Dot grid in pixel space
  vec2 px = v_uv * u_resolution;

  float c = channel(px, A_C, cmyk.x, G_C, F_C);
  float m = channel(px, A_M, cmyk.y, G_M, 0.0);
  float y = channel(px, A_Y, cmyk.z, G_Y, 0.0);
  float k = channel(px, A_K, cmyk.w, G_K, 0.0);

  // Multiplicative ink blending on paper
  vec3 result = PAPER;
  result *= mix(vec3(1.0), INK_C, c);
  result *= mix(vec3(1.0), INK_M, m);
  result *= mix(vec3(1.0), INK_Y, y);
  result *= mix(vec3(1.0), INK_K, k);

  gl_FragColor = vec4(result, 1.0);
}`;

// ── WebGL helpers ────────────────────────────────────────────────────

function compile(
	gl: WebGLRenderingContext,
	type: number,
	src: string,
): WebGLShader | null {
	const s = gl.createShader(type);
	if (!s) return null;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		console.error("Shader compile:", gl.getShaderInfoLog(s));
		gl.deleteShader(s);
		return null;
	}
	return s;
}

function link(gl: WebGLRenderingContext): WebGLProgram | null {
	const vs = compile(gl, gl.VERTEX_SHADER, VERT);
	const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
	if (!vs || !fs) return null;
	const p = gl.createProgram();
	if (!p) return null;
	gl.attachShader(p, vs);
	gl.attachShader(p, fs);
	gl.linkProgram(p);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		console.error("Program link:", gl.getProgramInfoLog(p));
		return null;
	}
	return p;
}

function quad(gl: WebGLRenderingContext, program: WebGLProgram) {
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	// Two triangles covering [-1,1] clip space
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		gl.STATIC_DRAW,
	);
	const loc = gl.getAttribLocation(program, "a_position");
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

// ── Shader parameters ────────────────────────────────────────────────

const RESTING = { dotSize: 0.42, softness: 0.65, gridNoise: 0.01 };
const HOVERED = { dotSize: 0.48, softness: 0.45, gridNoise: 0.05 };
const SPRING = { stiffness: 150, damping: 20, mass: 1 };

// ── Component ────────────────────────────────────────────────────────

interface Props {
	src: string;
	alt?: string;
	idPrefix?: string;
}

export default function HalftonePhoto({
	src,
	alt = "Photo",
	idPrefix = "frame",
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glCtx = useRef<{
		gl: WebGLRenderingContext;
		u: Record<string, WebGLUniformLocation | null>;
	} | null>(null);

	// 3D tilt (reuses existing spring config from PhotoFrame)
	const frameConfig = useSpringConfig("photoFrameTilt");
	const rotateX = useMotionValue(0);
	const rotateY = useMotionValue(0);
	const springX = useSpring(rotateX, frameConfig);
	const springY = useSpring(rotateY, frameConfig);

	// Shader hover springs
	const dotSize = useSpring(RESTING.dotSize, SPRING);
	const softness = useSpring(RESTING.softness, SPRING);
	const gridNoise = useSpring(RESTING.gridNoise, SPRING);

	// WebGL setup
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = 300 * dpr;
		canvas.height = 200 * dpr;

		const gl = canvas.getContext("webgl", {
			antialias: false,
			alpha: false,
			preserveDrawingBuffer: false,
		});
		if (!gl) {
			// Fallback: draw plain image via canvas 2D when WebGL unavailable
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const fallbackImg = new Image();
			fallbackImg.crossOrigin = "anonymous";
			fallbackImg.onload = () => {
				const cw = canvas.width,
					ch = canvas.height;
				const imgAspect = fallbackImg.naturalWidth / fallbackImg.naturalHeight;
				const canvasAspect = cw / ch;
				let sw = fallbackImg.naturalWidth,
					sh = fallbackImg.naturalHeight;
				let sx = 0,
					sy = 0;
				if (canvasAspect > imgAspect) {
					sh = sw / canvasAspect;
					sy = (fallbackImg.naturalHeight - sh) / 2;
				} else {
					sw = sh * canvasAspect;
					sx = (fallbackImg.naturalWidth - sw) / 2;
				}
				ctx.drawImage(fallbackImg, sx, sy, sw, sh, 0, 0, cw, ch);
			};
			fallbackImg.src = src;
			return;
		}

		const program = link(gl);
		if (!program) return;

		gl["useProgram"](program);
		quad(gl, program);
		gl.viewport(0, 0, canvas.width, canvas.height);

		const u = (n: string) => gl.getUniformLocation(program, n);
		const uniforms = {
			u_image: u("u_image"),
			u_resolution: u("u_resolution"),
			u_imageAspect: u("u_imageAspect"),
			u_cellSize: u("u_cellSize"),
			u_dotSize: u("u_dotSize"),
			u_softness: u("u_softness"),
			u_contrast: u("u_contrast"),
			u_gridNoise: u("u_gridNoise"),
		};

		// Static uniforms
		gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
		gl.uniform1f(uniforms.u_cellSize, 4.5); // fixed ~4.5px cells = ~130 dots across at 2x DPR
		gl.uniform1f(uniforms.u_contrast, 1.1);
		gl.uniform1f(uniforms.u_dotSize, RESTING.dotSize);
		gl.uniform1f(uniforms.u_softness, RESTING.softness);
		gl.uniform1f(uniforms.u_gridNoise, RESTING.gridNoise);

		glCtx.current = { gl, u: uniforms };

		const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Load image texture
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const tex = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.uniform1i(uniforms.u_image, 0);
			gl.uniform1f(
				uniforms.u_imageAspect,
				img.naturalWidth / img.naturalHeight,
			);
			draw();
		};
		img.src = src;

		// Spring → uniform → draw (no React re-renders)
		const unsubs = [
			dotSize.on("change", (v) => {
				gl.uniform1f(uniforms.u_dotSize, v);
				draw();
			}),
			softness.on("change", (v) => {
				gl.uniform1f(uniforms.u_softness, v);
				draw();
			}),
			gridNoise.on("change", (v) => {
				gl.uniform1f(uniforms.u_gridNoise, v);
				draw();
			}),
		];

		return () => {
			for (const fn of unsubs) fn();
			gl.deleteProgram(program);
			glCtx.current = null;
		};
	}, [src, dotSize, softness, gridNoise]);

	// ── Pointer handlers ───────────────────────────────────────────────

	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		rotateY.set(((e.clientX - cx) / (rect.width / 2)) * 4);
		rotateX.set(((e.clientY - cy) / (rect.height / 2)) * -4);
	}

	function handlePointerEnter() {
		dotSize.set(HOVERED.dotSize);
		softness.set(HOVERED.softness);
		gridNoise.set(HOVERED.gridNoise);
	}

	function handlePointerLeave() {
		rotateX.set(0);
		rotateY.set(0);
		dotSize.set(RESTING.dotSize);
		softness.set(RESTING.softness);
		gridNoise.set(RESTING.gridNoise);
	}

	return (
		<motion.div
			className="w-[300px] h-[200px] shrink-0 relative"
			style={{
				rotateX: springX,
				rotateY: springY,
				transformPerspective: 800,
			}}
			onPointerMove={handlePointerMove}
			onPointerEnter={handlePointerEnter}
			onPointerLeave={handlePointerLeave}
		>
			<canvas
				ref={canvasRef}
				aria-label={alt}
				role="img"
				className="block w-full h-full rounded-[16px] bg-halftone-base shadow-[color(display-p3_0.608_0.657_0.681)_0px_2px_32px_4px]"
			/>
			<PostItNote idPrefix={idPrefix} />
		</motion.div>
	);
}
