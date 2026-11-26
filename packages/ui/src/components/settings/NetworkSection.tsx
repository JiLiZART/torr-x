import { useEffect, useState } from "react";
import { api, type Encryption, type ProxyKind } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { randomPort } from "../../lib/settings";
import { Button, Chip, Group, NumberInput, Row, Select, TextInput, Toggle } from "./rows";
import type { SectionProps } from "./sections";

/** The last port test, kept for the session: tests run only when the user asks. */
let lastTest: { open: boolean | null; at: number } | null = null;

const PROXY_FEATURE: Record<Exclude<ProxyKind, "none">, string> = { http: "proxyHttp", socks4: "proxySocks4", socks5: "proxySocks5" };
const PROXY_LABEL: Record<Exclude<ProxyKind, "none">, string> = { http: "HTTP", socks4: "SOCKS4", socks5: "SOCKS5" };

function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function NetworkSection({ store, row, dhtNodes, onError }: SectionProps & { dhtNodes: number | null }) {
  const { t, gate, caps } = useUi();
  const engine = caps?.engine ?? "";
  const [test, setTest] = useState(lastTest);
  const [testing, setTesting] = useState(false);
  const now = useNow(30_000);
  const v = store.value;
  const port = v<number>("network.listenPort");
  const proxyType = v<ProxyKind>("network.proxy.type");
  const kinds = Object.keys(PROXY_FEATURE) as (keyof typeof PROXY_FEATURE)[];
  const lacking = kinds.filter((k) => gate(PROXY_FEATURE[k]));
  const offered = kinds.filter((k) => !gate(PROXY_FEATURE[k]));
  const noProxy = proxyType === "none";
  const testHint = gate("portTest");

  const runTest = async () => {
    setTesting(true);
    try {
      const { open } = await api.portTest();
      lastTest = { open, at: Date.now() };
      setTest(lastTest);
    } catch (e) {
      onError(e);
    } finally {
      setTesting(false);
    }
  };

  const ago = (at: number) => {
    const mins = Math.floor((now - at) / 60_000);
    return mins < 1 ? t("set.justNow") : t("set.minutesAgo", { n: mins });
  };
  const result = test?.open === true ? "open" : test?.open === false ? "closed" : null;

  return (
    <>
      <Group title={t("set.group.connection")} caption={t("set.group.connectionCaption")}>
        <Row {...row("listenPort", "network.listenPort")} unsupported={gate("listenPort")}>
          {result && <Chip tone={result === "open" ? "good" : "bad"}>{t(`set.port.${result}`)}</Chip>}
          <NumberInput label={t("set.listenPort")} value={port} min={0} max={65535} width="w-[110px]" onCommit={(n) => store.change("network.listenPort", n)} />
          <Button onClick={() => store.change("network.listenPort", randomPort(port))}>{t("set.random")}</Button>
        </Row>
        <Row {...row("upnp", "network.upnp")} unsupported={gate("upnp")}>
          <Toggle label={t("set.upnp")} on={v("network.upnp")} onChange={(on) => store.change("network.upnp", on)} />
        </Row>
        <Row
          {...row("portTest")}
          unsupported={testHint}
          desc={testHint ? undefined : test ? t("set.portTest.checked", { age: ago(test.at) }) : t("set.portTest.never")}
        >
          {test && <Chip tone={result === "open" ? "good" : result === "closed" ? "bad" : "neutral"}>{t(`set.portTest.${result ?? "unknown"}`)}</Chip>}
          <Button onClick={() => void runTest()} disabled={testing}>
            {testing ? t("set.portTest.testing") : test ? t("set.portTest.again") : t("set.portTest.run")}
          </Button>
        </Row>
      </Group>

      <Group title={t("set.group.discovery")} caption={t("set.group.discoveryCaption")}>
        <Row {...row("dht", "advanced.dht")} unsupported={gate("dht")}>
          {v<boolean>("advanced.dht") && dhtNodes !== null && <Chip tone="good">{t("set.dhtNodes", { n: dhtNodes })}</Chip>}
          <Toggle label={t("set.dht")} on={v("advanced.dht")} onChange={(on) => store.change("advanced.dht", on)} />
        </Row>
        <Row {...row("pex", "advanced.pex")} unsupported={gate("pex")}>
          <Toggle label={t("set.pex")} on={v("advanced.pex")} onChange={(on) => store.change("advanced.pex", on)} />
        </Row>
        <Row {...row("lpd", "advanced.lpd")} unsupported={gate("lpd")}>
          <Toggle label={t("set.lpd")} on={v("advanced.lpd")} onChange={(on) => store.change("advanced.lpd", on)} />
        </Row>
      </Group>

      <Group title={t("set.group.encryption")} caption={t("set.group.encryptionCaption")}>
        <Row {...row("encryption", "network.encryption")} unsupported={gate("encryption")}>
          <Select<Encryption>
            label={t("set.encryption")}
            width="w-[210px]"
            value={v("network.encryption") ?? "preferred"}
            onChange={(next) => store.change("network.encryption", next)}
            options={(["preferred", "required", "tolerated"] as const).map((value) => ({ value, label: t(`set.encryption.${value}`) }))}
          />
        </Row>
      </Group>

      <Group
        title={t("set.group.proxy")}
        caption={offered.length === 0 ? t("set.group.proxyNone", { engine }) : t("set.group.proxyOnly", { engine, types: offered.map((k) => PROXY_LABEL[k]).join(", ") })}
      >
        <Row {...row("proxyType", "network.proxy.type")} unsupported={offered.length === 0 ? t("caps.notSupported", { engine }) : undefined}>
          <Select<ProxyKind>
            label={t("set.proxyType")}
            width="w-[160px]"
            value={proxyType}
            onChange={(next) => store.change("network.proxy.type", next)}
            options={[
              { value: "none", label: t("set.proxy.none") },
              ...kinds.map((k) => ({ value: k, label: PROXY_LABEL[k], disabled: gate(PROXY_FEATURE[k]) })),
            ]}
          />
        </Row>
        {offered.length > 0 && (
          <>
            <Row {...row("proxyAddress", "network.proxy.host")} muted={noProxy}>
              <TextInput label={t("set.proxyHost")} width="w-[150px]" placeholder="127.0.0.1" disabled={noProxy} value={v("network.proxy.host")} onCommit={(s) => store.change("network.proxy.host", s.trim())} />
              <NumberInput label={t("set.proxyPort")} width="w-[84px]" min={1} max={65535} disabled={noProxy} value={v("network.proxy.port")} onCommit={(n) => store.change("network.proxy.port", n)} />
            </Row>
            <Row {...row("proxyAuth", "network.proxy.authRequired")} muted={noProxy}>
              <Toggle label={t("set.proxyAuth")} disabled={noProxy} on={v("network.proxy.authRequired")} onChange={(on) => store.change("network.proxy.authRequired", on)} />
            </Row>
            {v<boolean>("network.proxy.authRequired") && (
              <>
                <Row {...row("proxyUsername", "network.proxy.username")} muted={noProxy}>
                  <TextInput label={t("set.proxyUsername")} disabled={noProxy} value={v("network.proxy.username")} onCommit={(s) => store.change("network.proxy.username", s)} />
                </Row>
                <Row {...row("proxyPassword", "network.proxy.password")} muted={noProxy}>
                  <TextInput
                    type="password"
                    label={t("set.proxyPassword")}
                    disabled={noProxy}
                    value={v<string | undefined>("network.proxy.password") ?? ""}
                    placeholder={store.saved?.network.proxy.hasPassword ? t("set.unchanged") : ""}
                    onCommit={(s) => store.change("network.proxy.password", s)}
                  />
                </Row>
              </>
            )}
          </>
        )}
        {offered.length > 0 && lacking.length > 0 && (
          <Row
            {...row("proxyUnsupported")}
            title={t("set.proxyUnsupported", { types: lacking.map((k) => PROXY_LABEL[k]).join(" / ") })}
            desc={t("set.proxyUnsupported.desc", { engine })}
            unsupported={t("caps.notSupported", { engine })}
          />
        )}
      </Group>
    </>
  );
}
