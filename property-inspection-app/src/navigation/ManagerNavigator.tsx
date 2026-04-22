import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors, Typography } from '../lib/theme';
import { ManagerStackParamList } from '../types';
import DashboardScreen from '../screens/manager/DashboardScreen';
import PropertyDetailScreen from '../screens/manager/PropertyDetailScreen';
import AddPropertyScreen from '../screens/manager/AddPropertyScreen';
import ConductInspectionScreen from '../screens/inspector/ConductInspectionScreen';
import InspectionDetailScreen from '../screens/manager/InspectionDetailScreen';
import IssuesScreen from '../screens/manager/IssuesScreen';
import AddIssueScreen from '../screens/manager/AddIssueScreen';
import ManualsScreen from '../screens/ManualsScreen';
import TasksScreen from '../screens/TasksScreen';
import DeedMonitorScreen from '../screens/manager/DeedMonitorScreen';

const Stack = createNativeStackNavigator<ManagerStackParamList>();

export default function ManagerNavigator() {
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
        name="ConductInspection"
        component={ConductInspectionScreen}
        options={{ title: 'Inspection Checklist' }}
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
      <Stack.Screen
        name="AddIssue"
        component={AddIssueScreen}
        options={{ title: 'New Issue' }}
      />
      <Stack.Screen
        name="Manuals"
        component={ManualsScreen}
        options={{ title: 'Company Manuals' }}
      />
      <Stack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: 'Task Board' }}
      />
      <Stack.Screen
        name="DeedMonitor"
        component={DeedMonitorScreen}
        options={{ title: 'Deed Monitor' }}
      />
    </Stack.Navigator>
  );
}
