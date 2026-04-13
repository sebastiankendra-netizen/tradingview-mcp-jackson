import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Colors, Typography } from '../lib/theme';
import { ManagerStackParamList } from '../types';
import DashboardScreen from '../screens/manager/DashboardScreen';
import PropertyDetailScreen from '../screens/manager/PropertyDetailScreen';
import AddPropertyScreen from '../screens/manager/AddPropertyScreen';
import InspectionDetailScreen from '../screens/manager/InspectionDetailScreen';
import IssuesScreen from '../screens/manager/IssuesScreen';

const Stack = createStackNavigator<ManagerStackParamList>();

export default function ManagerNavigator() {
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
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Properties"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: 'Property Details' }}
      />
      <Stack.Screen
        name="AddProperty"
        component={AddPropertyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InspectionDetail"
        component={InspectionDetailScreen}
        options={{ title: 'Inspection Report' }}
      />
      <Stack.Screen
        name="AllIssues"
        component={IssuesScreen}
        options={{ title: 'Maintenance Issues' }}
      />
    </Stack.Navigator>
  );
}
