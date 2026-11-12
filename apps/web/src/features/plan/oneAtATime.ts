/**
 * A write that must not run twice at once. The returned function starts `fn` and answers true; while the promise `fn`
 * returned is still pending it does nothing and answers false. It opens again when that promise settles either way, at
 * once when `fn` threw before it had one, and at once when `fn` started nothing (it returned no promise).
 *
 * A button's `disabled` waits for a render; this is set in the press itself, so two presses in one task send once.
 * Keep the returned function for the life of the component (a ref): each call of `oneAtATime` is its own lock.
 */
export const oneAtATime = <A extends unknown[]>(fn: (...args: A) => PromiseLike<unknown> | void | undefined): ((...args: A) => boolean) => {
  let busy = false;
  return (...args: A) => {
    if (busy) return false;
    busy = true;
    let p: PromiseLike<unknown> | void | undefined;
    try {
      p = fn(...args);
    } catch (e) {
      busy = false;
      throw e;
    }
    if (!p) {
      busy = false;
      return true;
    }
    const open = () => void (busy = false);
    p.then(open, open);
    return true;
  };
};
