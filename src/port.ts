export default (() => {
  if (process.env.PORT) return parseInt(process.env.PORT, 10);
  return 3000;
})();
