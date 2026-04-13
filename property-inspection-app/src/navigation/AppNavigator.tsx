import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../lib/theme';
import { RootStackParamList } from '../types';
import LoginScreen from '../screens/LoginScreen';
import ManagerNavigator from './ManagerNavigator';
import InspectorNavigator from './InspectorNavigator';
import MaintenanceNavigator from './MaintenanceNavigator';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      {!session || !profile ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : profile.role === 'manager' ? (
        <Stack.Screen name="ManagerTabs" component={ManagerNavigator} />
      ) : profile.role === 'inspector' ? (
        <Stack.Screen name="InspectorTabs" component={InspectorNavigator} />
      ) : (
        <Stack.Screen name="MaintenanceTabs" component={MaintenanceNavigator} />
      )}
    </Stack.Navigator>
  );
}
