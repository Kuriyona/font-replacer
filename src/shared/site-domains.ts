import { getDomain } from "tldts";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * 取可注册域名（eTLD+1）；localhost、IP、无公共后缀的主机返回 null。
 */
export function toRegistrableDomain(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (host === "") return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (host.startsWith("[") || IPV4.test(host)) return null;
  return getDomain(host, { allowPrivateDomains: true });
}
