/**
 * Type declarations for react-native-torch (no official @types package).
 * Covers only the API surface Vedra uses.
 */
declare module 'react-native-torch' {
  const Torch: {
    /** Turn the device torch on (true) or off (false). */
    switchState(newState: boolean): Promise<boolean>;
    /** Request CAMERA permission needed for torch on Android. */
    requestCameraPermission(title: string, message: string): Promise<boolean>;
  };
  export default Torch;
}
