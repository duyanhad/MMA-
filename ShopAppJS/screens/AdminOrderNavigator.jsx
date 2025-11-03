import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import OrderManagerScreen from "./OrderManagerScreen";
import OrderDetailScreen from "./OrderDetailScreen";

const Stack = createStackNavigator();

export default function AdminOrderNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS, // hiệu ứng slide
      }}
    >
      <Stack.Screen name="OrderManager" component={OrderManagerScreen} />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid, // hiệu ứng fade
        }}
      />
    </Stack.Navigator>
  );
}
