// Side-effect CSS imports — Next's global types cover *.css, but some
// TS-server setups flag deep node_modules paths before env reload.
declare module "katex/dist/katex.min.css";
