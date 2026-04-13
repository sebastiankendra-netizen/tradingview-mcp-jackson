import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Colors, Typography } from '../lib/theme';
import { MaintenanceStackParamList } from '../types';
import MyIssuesScreen from '../screens/maintenance/MyIssuesScreen';

const Stack = createStackNavigator<MaintenanceStackParamList>();

export default function MaintenanceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { ...Typography.h3, color: Colors.textPrimary },
        headerTintColor: Colors.primary,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="MyIssues"
        component={MyIssuesScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
