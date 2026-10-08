interface RuntimeEnv {
  GOOGLE_CLIENT_ID?: string;
  PUBLIC_MQTT_URL?: string;
  FIRMWARE_FILE?: string;
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

export const env = {
  googleClientId: window.__ENV__?.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  publicMqttUrl: window.__ENV__?.PUBLIC_MQTT_URL || import.meta.env.VITE_PUBLIC_MQTT_URL || "",
  firmwareFile: window.__ENV__?.FIRMWARE_FILE || "",
};
