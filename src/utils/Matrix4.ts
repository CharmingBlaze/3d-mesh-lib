/**
 * 📐 Matrix4 - Minimal 4x4 Matrix utility for glTF skinning
 *
 * Provides basic 4x4 matrix operations. Matrices are represented as 16-element number arrays (column-major).
 */

import { Vector3D } from './Vector3D';

export type Matrix4Data = [
  number, number, number, number, // col 1
  number, number, number, number, // col 2
  number, number, number, number, // col 3
  number, number, number, number  // col 4
];

export class Matrix4 {
  /**
   * Creates a new identity matrix.
   * @returns A 16-element array representing an identity matrix.
   */
  static identity(): Matrix4Data {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  /**
   * Creates a new translation matrix.
   * @param v The translation vector.
   * @returns A 16-element array representing a translation matrix.
   */
  static fromTranslation(v: Vector3D): Matrix4Data {
    return [
      1,    0,    0,    0,
      0,    1,    0,    0,
      0,    0,    1,    0,
      v.x,  v.y,  v.z,  1
    ];
  }

  /**
   * Creates a new scaling matrix.
   * @param v The scaling vector.
   * @returns A 16-element array representing a scaling matrix.
   */
  static fromScaling(v: Vector3D): Matrix4Data {
    return [
      v.x,  0,    0,    0,
      0,    v.y,  0,    0,
      0,    0,    v.z,  0,
      0,    0,    0,    1
    ];
  }

  /**
   * Multiplies two 4x4 matrices (a * b).
   * Matrices are 16-element arrays in column-major order.
   * @param a The first matrix.
   * @param b The second matrix.
   * @returns The resulting matrix.
   */
  static multiply(a: Matrix4Data, b: Matrix4Data): Matrix4Data {
    const result = Matrix4.identity();
    const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
    const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
    const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = b[0],  b01 = b[1],  b02 = b[2],  b03 = b[3];
    const b10 = b[4],  b11 = b[5],  b12 = b[6],  b13 = b[7];
    const b20 = b[8],  b21 = b[9],  b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    result[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    result[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    result[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    result[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

    result[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
    result[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
    result[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
    result[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

    result[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
    result[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
    result[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
    result[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

    result[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
    result[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
    result[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
    result[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

    return result;
  }

  // TODO: Implement fromRotationQuaternion, compose, and invert
  static fromRotationQuaternion(q: { x: number; y: number; z: number; w: number }): Matrix4Data {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return [
      1 - (yy + zz),  xy + wz,        xz - wy,        0,
      xy - wz,        1 - (xx + zz),  yz + wx,        0,
      xz + wy,        yz - wx,        1 - (xx + yy),  0,
      0,              0,              0,              1
    ];
  }

  static compose(translation: Vector3D, q: { x: number; y: number; z: number; w: number }, scale: Vector3D): Matrix4Data {
    // Computes T * R * S
    const t = Matrix4.fromTranslation(translation);
    const r = Matrix4.fromRotationQuaternion(q);
    const s = Matrix4.fromScaling(scale);
    return Matrix4.multiply(Matrix4.multiply(t, r), s); // T * R * S
  }

  static invert(m: Matrix4Data): Matrix4Data | null {
    const m00 = m[0], m01 = m[4], m02 = m[8],  m03 = m[12];
    const m10 = m[1], m11 = m[5], m12 = m[9],  m13 = m[13];
    const m20 = m[2], m21 = m[6], m22 = m[10], m23 = m[14];
    const m30 = m[3], m31 = m[7], m32 = m[11], m33 = m[15];

    const c00 = m11 * m22 * m33 - m11 * m23 * m32 - m21 * m12 * m33 + m21 * m13 * m32 + m31 * m12 * m23 - m31 * m13 * m22;
    const c01 = -m10 * m22 * m33 + m10 * m23 * m32 + m20 * m12 * m33 - m20 * m13 * m32 - m30 * m12 * m23 + m30 * m13 * m22;
    const c02 = m10 * m21 * m33 - m10 * m23 * m31 - m20 * m11 * m33 + m20 * m13 * m31 + m30 * m11 * m23 - m30 * m13 * m21;
    const c03 = -m10 * m21 * m32 + m10 * m22 * m31 + m20 * m11 * m32 - m20 * m12 * m31 - m30 * m11 * m22 + m30 * m12 * m21;

    const det = m00 * c00 + m01 * c01 + m02 * c02 + m03 * c03;

    if (Math.abs(det) < 1e-8) { // Using a small epsilon for zero check
      console.warn('Matrix4.invert: Matrix is singular, determinant is close to zero.');
      return null; // Or return identity, or throw error, depending on desired behavior
    }

    const invDet = 1.0 / det;

    const c10 = -m01 * m22 * m33 + m01 * m23 * m32 + m21 * m02 * m33 - m21 * m03 * m32 - m31 * m02 * m23 + m31 * m03 * m22;
    const c11 = m00 * m22 * m33 - m00 * m23 * m32 - m20 * m02 * m33 + m20 * m03 * m32 + m30 * m02 * m23 - m30 * m03 * m22;
    const c12 = -m00 * m21 * m33 + m00 * m23 * m31 + m20 * m01 * m33 - m20 * m03 * m31 - m30 * m01 * m23 + m30 * m03 * m21;
    const c13 = m00 * m21 * m32 - m00 * m22 * m31 - m20 * m01 * m32 + m20 * m02 * m31 + m30 * m01 * m22 - m30 * m02 * m21;

    const c20 = m01 * m12 * m33 - m01 * m13 * m32 - m11 * m02 * m33 + m11 * m03 * m32 + m31 * m02 * m13 - m31 * m03 * m12;
    const c21 = -m00 * m12 * m33 + m00 * m13 * m32 + m10 * m02 * m33 - m10 * m03 * m32 - m30 * m02 * m13 + m30 * m03 * m12;
    const c22 = m00 * m11 * m33 - m00 * m13 * m31 - m10 * m01 * m33 + m10 * m03 * m31 + m30 * m01 * m13 - m30 * m03 * m11;
    const c23 = -m00 * m11 * m32 + m00 * m12 * m31 + m10 * m01 * m32 - m10 * m02 * m31 - m30 * m01 * m12 + m30 * m02 * m11;

    const c30 = -m01 * m12 * m23 + m01 * m13 * m22 + m11 * m02 * m23 - m11 * m03 * m22 - m21 * m02 * m13 + m21 * m03 * m12;
    const c31 = m00 * m12 * m23 - m00 * m13 * m22 - m10 * m02 * m23 + m10 * m03 * m22 + m20 * m02 * m13 - m20 * m03 * m12;
    const c32 = -m00 * m11 * m23 + m00 * m13 * m21 + m10 * m01 * m23 - m10 * m03 * m21 - m20 * m01 * m13 + m20 * m03 * m11;
    const c33 = m00 * m11 * m22 - m00 * m12 * m21 - m10 * m01 * m22 + m10 * m02 * m21 + m20 * m01 * m12 - m20 * m02 * m11;

    return [
      c00 * invDet, c10 * invDet, c20 * invDet, c30 * invDet, // Column 1 of adj(A)^T * invDet
      c01 * invDet, c11 * invDet, c21 * invDet, c31 * invDet, // Column 2
      c02 * invDet, c12 * invDet, c22 * invDet, c32 * invDet, // Column 3
      c03 * invDet, c13 * invDet, c23 * invDet, c33 * invDet  // Column 4
    ];
  }
}
