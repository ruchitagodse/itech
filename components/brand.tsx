import Image from "next/image";
export function Brand({ light = false }: { light?: boolean }) {
  return <div className={"brand" + (light ? " brand-light" : "")}><Image src="/itech-logo.jpeg" alt="iTech Care" width={156} height={77} priority style={{ objectFit: "contain" }} /></div>;
}
