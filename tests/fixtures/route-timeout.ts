/**
 * Test fixture: script that times out (never resolves).
 */
export default function route() {
  return new Promise(() => {});
}
