import {
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";

export async function requestMicrophonePermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
    return granted === true;
}

export async function getMicrophonePermissionStatus(): Promise<string> {
  const { status } = await getRecordingPermissionsAsync();
    return status;
}

export async function configureAudioForRecording(): Promise<void> {
    await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    interruptionMode: "doNotMix",
    shouldPlayInBackground: false,
  });
}
