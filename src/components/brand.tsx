export function Brand({ light = false }: { light?: boolean }) {
  return <div className={"brand" + (light ? " brand-light" : "")}><span className="brand-symbol" aria-hidden="true">i</span><span>iTech<span className="brand-version">V2</span></span></div>;
}
