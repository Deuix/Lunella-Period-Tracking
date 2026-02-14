import { Stack } from "expo-router";
import "react-native-reanimated";
import "../i18n";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
