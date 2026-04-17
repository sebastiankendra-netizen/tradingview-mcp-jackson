import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors, Typography } from '../lib/theme';
import { InspectorStackParamList } from '../types';
import MyPropertiesScreen from '../screens/inspector/MyPropertiesScreen';
import ConductInspectionScreen from '../screens/inspector/ConductInspectionScreen';
import ManualsScreen from '../screens/ManualsScreen';

const Stack = createNativeStackNavigator<InspectorStackParamList>();

export default function InspectorNavigator() {
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
        name="MyProperties"
        component={MyPropertiesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConductInspection"
        component={ConductInspectionScreen}
        options={{ title: 'Inspection Checklist' }}
      />
      <Stack.Screen
        name="Manuals"
        component={ManualsScreen}
        options={{ title: 'Company Manuals' }}
      />
    </Stack.Navigator>
  );
}
