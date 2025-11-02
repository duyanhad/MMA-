// screens/AccountScreen.jsx (Đã sửa lỗi Đăng xuất)
import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator // Thêm ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native'; 

// Định nghĩa màu
const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const ERROR_COLOR = '#E74C3C'; // Màu cho nút Admin
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BACKGROUND_COLOR = '#F5F5F5';


export default function AccountScreen({ navigation }) {
  const [user, setUser] = useState(null);

  // Load User Data (đã lưu từ LoginScreen)
  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userInfo'); // Lấy từ 'userInfo'
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        // Nếu không có dữ liệu, ép đăng xuất
        handleLogout(true); 
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin người dùng:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );
  
  // Xử lý Đăng xuất
  const handleLogout = (force = false) => {
    const logoutAction = async () => {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userInfo');
      
      // 🚀 FIX: Reset về màn hình 'Login' (theo App.js)
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }], // Quay về màn hình Login
        })
      );
    };

    if (force) {
      logoutAction();
      return;
    }

    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Đồng ý", 
          style: 'destructive',
          onPress: logoutAction
        }
      ]
    );
  };

  // Các nút điều hướng
  const menuItems = [
    { name: 'Lịch sử đơn hàng', icon: 'receipt-outline', target: 'OrderHistory' },
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.name}
      style={styles.menuItem}
      onPress={() => item.target && navigation.navigate(item.target)}
    >
      <Ionicons name={item.icon} size={24} color={ACCENT_COLOR} />
      <Text style={styles.menuText}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#888" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài Khoản</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* User Info Card */}
        <View style={styles.profileCard}>
          {user ? (
            <>
              <Ionicons name="person-circle-outline" size={70} color={PRIMARY_COLOR} />
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {/* HIỂN THỊ ROLE (Nếu là Admin) */}
              {user.role === 'admin' && (
                <Text style={styles.adminBadge}>ADMIN</Text>
              )}
            </>
          ) : (
            <ActivityIndicator color={PRIMARY_COLOR} />
          )}
        </View>

        {/* NÚT QUẢN LÝ (CHỈ ADMIN MỚI THẤY) */}
        {user && user.role === 'admin' && (
          <View style={styles.adminMenuContainer}>
            <TouchableOpacity
              style={[styles.menuItem, styles.adminButton]}
              // Điều hướng đến 'AdminDashboard' (đã khai báo trong App.js mới)
              onPress={() => navigation.navigate('AdminDashboard')} 
            >
              <Ionicons name="shield-checkmark-outline" size={24} color={ERROR_COLOR} />
              <Text style={[styles.menuText, styles.adminText]}>Quản lý Cửa hàng (Admin)</Text>
              <Ionicons name="chevron-forward" size={20} color={ERROR_COLOR} />
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Items (Khách hàng) */}
        <View style={styles.menuContainer}>
          {menuItems.map(renderMenuItem)}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => handleLogout(false)}
        >
          <Text style={styles.logoutText}>ĐĂNG XUẤT</Text>
        </TouchableOpacity>

      </ScrollView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  scrollContent: { padding: 20 },
  
  profileCard: {
    backgroundColor: LIGHT_TEXT_COLOR,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginTop: 10,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  adminBadge: {
    marginTop: 5,
    color: ERROR_COLOR,
    fontWeight: 'bold',
    fontSize: 12,
    borderWidth: 1,
    borderColor: ERROR_COLOR,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  
  menuContainer: {
    backgroundColor: LIGHT_TEXT_COLOR,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: BACKGROUND_COLOR,
  },
  menuText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  
  adminMenuContainer: {
    backgroundColor: '#FFF0F0', // Nền đỏ nhạt
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3,
    borderColor: ERROR_COLOR,
    borderWidth: 1,
  },
  adminButton: {
    borderBottomWidth: 0,
  },
  adminText: {
    color: ERROR_COLOR,
    fontWeight: 'bold',
  },

  logoutButton: {
    backgroundColor: ACCENT_COLOR,
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  logoutText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 18,
    fontWeight: 'bold',
  },
});