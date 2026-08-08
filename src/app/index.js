import { Redirect } from 'expo-router';

// Redirect the root route to the (tabs) group
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
