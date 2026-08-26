export function createSerialQueue(onError = () => {}) {
  let tail = Promise.resolve();
  return {
    run(task) {
      const result = tail.then(task);
      // Preserve the caller's rejection while keeping the internal queue live
      // for the next task.
      tail = result.catch(onError);
      return result;
    },
  };
}
