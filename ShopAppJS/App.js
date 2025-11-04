// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';



// 🚀 Màn hình Auth
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// 🚀 Màn hình Khách hàng (Customer)
import HomeScreen from './screens/HomeScreen.jsx';
import ProductDetailScreen from './screens/ProductDetailScreen.jsx';
import CartScreen from './screens/CartScreen.jsx';
import CheckoutScreen from './screens/CheckoutScreen.jsx'; 
import OrderHistoryScreen from './screens/OrderHistoryScreen.jsx'; 
import SearchScreen from './screens/SearchScreen.jsx';
import AccountScreen from './screens/AccountScreen.jsx';
import ThankYouScreen from './screens/ThankYouScreen.jsx';
import OrderDetailScreen from './screens/OrderDetailScreen.jsx';

// 🚀 Màn hình Admin
import AdminDashboard from './screens/AdminDashboard.jsx';
import AdminProductList from './screens/AdminProductList.jsx';
import AdminProductEdit from './screens/AdminProductEdit.jsx';
import AdminUserList from './screens/AdminUserList.jsx';
import OrderManagerScreen from './screens/OrderManagerScreen.jsx';
import AdminInventoryScreen from './screens/AdminInventoryScreen';
import AdminSettingsScreen from "./screens/AdminSettingsScreen";
import RevenueStatsScreen from "./screens/RevenueStatsScreen";
// (AdminUserEdit đã bị xóa theo yêu cầu)

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        // 🚀 LỖI XẢY RA Ở ĐÂY: Nó tìm 'Login'
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* 🚀 VÀ KHÔNG TÌM THẤY DÒNG NÀY: */}
        <Stack.Screen name="Login" component={LoginScreen} />
        
        {/* Auth Stack */}
        <Stack.Screen name="Register" component={RegisterScreen} />
        
        {/* Main App Stack */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="ThankYou" component={ThankYouScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        
        {/* Admin Stack */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="AdminProductList" component={AdminProductList} />
        <Stack.Screen name="AdminProductEdit" component={AdminProductEdit} />
        <Stack.Screen name="AdminUserList" component={AdminUserList} />
        <Stack.Screen name="OrderManager" component={OrderManagerScreen} />
        <Stack.Screen name="RevenueStatsScreen" component={RevenueStatsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ headerShown: false }} /><Stack.Screen 
        
  name="AdminInventoryScreen" 
  component={AdminInventoryScreen} 
  options={{ title: "Quản lý kho" }}
/>

    
      </Stack.Navigator>
    </NavigationContainer>
  );
}