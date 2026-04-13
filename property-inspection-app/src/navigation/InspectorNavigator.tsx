import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Colors, Typography } from '../lib/theme';
import { InspectorStackParamList } from '../types';
import MyPropertiesScreen from '../screens/inspector/MyPropertiesScreen';
import ConductInspectionScreen from '../screens/inspector/ConductInspectionScreen';

const Stack = createStackNavigator<InspectorStackParamList>();

export default function InspectorNavigator() {
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
        name="MyProperties"
        component={MyPropertiesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConductInspection"
        component={ConductInspectionScreen}
        options={{ title: 'Inspection Checklist' }}
      />
    </Stack.Navigator>
  );
}
