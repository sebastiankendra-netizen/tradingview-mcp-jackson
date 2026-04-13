import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotifications, savePushToken } from './src/lib/notifications';
import AppNavigator from './src/navigation/AppNavigator';

function PushNotificationRegistrar() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user.id) return;
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(session.user.id, token);
    });
  }, [session]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <PushNotificationRegistrar />
          <StatusBar style="auto" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
