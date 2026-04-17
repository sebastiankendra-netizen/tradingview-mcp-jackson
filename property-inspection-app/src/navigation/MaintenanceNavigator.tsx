import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors, Typography } from '../lib/theme';
import { MaintenanceStackParamList } from '../types';
import MyIssuesScreen from '../screens/maintenance/MyIssuesScreen';
import AddIssueScreen from '../screens/manager/AddIssueScreen';
import ManualsScreen from '../screens/ManualsScreen';

const Stack = createNativeStackNavigator<MaintenanceStackParamList>();

export default function MaintenanceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { ...Typography.h3, color: Colors.textPrimary },
        headerTintColor: Colors.primary,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="MyIssues"
        component={MyIssuesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddIssue"
        component={AddIssueScreen}
        options={{ title: 'Report Issue' }}
      />
      <Stack.Screen
        name="Manuals"
        component={ManualsScreen}
        options={{ title: 'Company Manuals' }}
      />
    </Stack.Navigator>
  );
}
