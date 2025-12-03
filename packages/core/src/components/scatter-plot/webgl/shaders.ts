// ============================================================================
// WebGL Shader Sources
// ============================================================================

// ============================================================================
// Point Rendering Shaders
// ============================================================================

export const POINT_VERTEX_SHADER_WEBGL2 = `#version 300 es
precision highp float;
in vec2 a_dataPosition;
in float a_pointSize;
in vec4 a_color;
uniform vec2 u_resolution;
uniform vec3 u_transform;
uniform float u_dpr;
out vec4 v_color;
void main() {
  vec2 cssTransformed = a_dataPosition * u_transform.z + u_transform.xy;
  vec2 physicalPos = cssTransformed * u_dpr;
  vec2 clipSpace = (physicalPos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  gl_PointSize = max(1.0, a_pointSize);
  v_color = a_color;
}`;

export const POINT_VERTEX_SHADER_WEBGL1 = `precision highp float;
attribute vec2 a_dataPosition;
attribute float a_pointSize;
attribute vec4 a_color;
uniform vec2 u_resolution;
uniform vec3 u_transform;
uniform float u_dpr;
varying vec4 v_color;
void main() {
  vec2 cssTransformed = a_dataPosition * u_transform.z + u_transform.xy;
  vec2 physicalPos = cssTransformed * u_dpr;
  vec2 clipSpace = (physicalPos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  gl_PointSize = max(1.0, a_pointSize);
  v_color = a_color;
}`;

export const POINT_FRAGMENT_SHADER_WEBGL2 = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float distSq = dot(coord, coord);
  float alpha = 1.0 - smoothstep(0.8, 1.0, distSq);
  if (alpha < 0.01) discard;
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}`;

export const POINT_FRAGMENT_SHADER_WEBGL1 = `precision highp float;
varying vec4 v_color;
void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float distSq = dot(coord, coord);
  float alpha = 1.0 - smoothstep(0.8, 1.0, distSq);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}`;

// ============================================================================
// Density Rendering Shaders
// ============================================================================

export const DENSITY_VERTEX_SHADER_WEBGL2 = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // Convert from clip space (-1 to 1) to texture coords (0 to 1)
  v_texCoord = (a_position + 1.0) * 0.5;
  // Flip Y for correct orientation
  v_texCoord.y = 1.0 - v_texCoord.y;
}`;

export const DENSITY_VERTEX_SHADER_WEBGL1 = `precision highp float;
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = (a_position + 1.0) * 0.5;
  v_texCoord.y = 1.0 - v_texCoord.y;
}`;

export const DENSITY_FRAGMENT_SHADER_WEBGL2 = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_densityTexture;
uniform float u_maxDensity;
uniform float u_opacity;
uniform vec3 u_colorLow;
uniform vec3 u_colorMid;
uniform vec3 u_colorHigh;
void main() {
  float density = texture(u_densityTexture, v_texCoord).r / 255.0;
  if (density < 0.02) discard;
  vec3 color;
  if (density < 0.5) {
    color = mix(u_colorLow, u_colorMid, density * 2.0);
  } else {
    color = mix(u_colorMid, u_colorHigh, (density - 0.5) * 2.0);
  }
  float alpha = pow(density, 0.6) * u_opacity;
  fragColor = vec4(color, alpha);
}`;

export const DENSITY_FRAGMENT_SHADER_WEBGL1 = `precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_densityTexture;
uniform float u_maxDensity;
uniform float u_opacity;
uniform vec3 u_colorLow;
uniform vec3 u_colorMid;
uniform vec3 u_colorHigh;
void main() {
  float density = texture2D(u_densityTexture, v_texCoord).r / 255.0;
  if (density < 0.02) discard;
  vec3 color;
  if (density < 0.5) {
    color = mix(u_colorLow, u_colorMid, density * 2.0);
  } else {
    color = mix(u_colorMid, u_colorHigh, (density - 0.5) * 2.0);
  }
  float alpha = pow(density, 0.6) * u_opacity;
  gl_FragColor = vec4(color, alpha);
}`;

// ============================================================================
// Shader Selection Helpers
// ============================================================================

export function getPointShaders(isWebGL2: boolean) {
  return {
    vertex: isWebGL2 ? POINT_VERTEX_SHADER_WEBGL2 : POINT_VERTEX_SHADER_WEBGL1,
    fragment: isWebGL2 ? POINT_FRAGMENT_SHADER_WEBGL2 : POINT_FRAGMENT_SHADER_WEBGL1,
  };
}

export function getDensityShaders(isWebGL2: boolean) {
  return {
    vertex: isWebGL2 ? DENSITY_VERTEX_SHADER_WEBGL2 : DENSITY_VERTEX_SHADER_WEBGL1,
    fragment: isWebGL2 ? DENSITY_FRAGMENT_SHADER_WEBGL2 : DENSITY_FRAGMENT_SHADER_WEBGL1,
  };
}

