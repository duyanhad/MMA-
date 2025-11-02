// screens/AdminUserList.jsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Định nghĩa màu
const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const ERROR_COLOR = '#E74C3C';
const SUCCESS_COLOR = '#2ECC71'; // 🚀 Thêm màu Xanh lá
const LIGHT_TEXT_COLOR = '#FFFFFF';
const TEXT_COLOR = '#333333';
const BACKGROUND_COLOR = '#F5F5F5';

// 🚨 Đảm bảo IP chính xác (của bạn là .102)
const API_URL = 'http://192.168.1.102:3000';

export default function AdminUserList({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState(null); // Để biết ID của admin đang đăng nhập

  // Lấy Token
  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return token;
  }, [navigation]);

  // Lấy tất cả người dùng
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      // Lấy ID của admin đang đăng nhập
      const userInfoString = await AsyncStorage.getItem('userInfo');
      if (userInfoString) {
        setSelfId(JSON.parse(userInfoString).id);
      }

      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // 🚀 FIX: Sửa lại cấu trúc useFocusEffect
  useFocusEffect(
    useCallback(() => {
      loadUsers();
      
      return () => {
        // cleanup
      };
    }, [loadUsers])
  );

  // Xử lý Khóa / Mở khóa
  const handleToggleBlock = (user) => {
    const newStatus = !user.isBlocked; // Trạng thái mới (ngược lại)
    const actionText = newStatus ? "KHÓA" : "MỞ KHÓA";

    Alert.alert(
      `Xác nhận ${actionText}`,
      `Bạn có chắc chắn muốn ${actionText} tài khoản "${user.name}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: actionText,
          style: newStatus ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              const res = await fetch(`${API_URL}/api/admin/users/${user.id}/toggle-block`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ isBlocked: newStatus }) // Gửi trạng thái mới
              });
              
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Thành công', `Đã ${actionText} tài khoản.`);
                loadUsers(); // Tải lại danh sách
              } else {
                throw new Error(data.message);
              }
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Thao tác thất bại.');
            }
          }
        }
      ]
    );
  };

  // Render
  const renderUserItem = ({ item }) => {
    const isSelf = selfId === item.id; // Kiểm tra xem đây có phải là admin đang đăng nhập
    
    return (
      <View style={[styles.userCard, item.isBlocked && styles.userCardBlocked]}>
        <Ionicons name="person-circle-outline" size={40} color={PRIMARY_COLOR} style={styles.userIcon} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          
          {/* Hiển thị tag Admin hoặc Bị khóa */}
          {item.isBlocked ? (
            <Text style={[styles.userRole, styles.userRoleBlocked]}>
              ĐÃ BỊ KHÓA
            </Text>
          ) : (
            <Text style={[styles.userRole, item.role === 'admin' && styles.userRoleAdmin]}>
              {item.role.toUpperCase()}
            </Text>
          )}

        </View>
        <View style={styles.userActions}>
          
          {/* Không hiển thị nút nếu là chính mình */}
          {!isSelf && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleToggleBlock(item)}
            >
              <Ionicons 
                name={item.isBlocked ? 'checkmark-circle-outline' : 'ban-outline'} // Icon Mở khóa hoặc Khóa
                size={24} 
                color={item.isBlocked ? SUCCESS_COLOR : ERROR_COLOR} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý Người dùng</Text>
        {/* Xóa nút Thêm mới, thay bằng 1 khoảng trống để căn giữa */}
        <View style={{ width: 38 }} /> 
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={LIGHT_TEXT_COLOR} style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có người dùng nào.</Text>}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PRIMARY_COLOR,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  listContainer: { padding: 15 },
  emptyText: { color: LIGHT_TEXT_COLOR, textAlign: 'center', marginTop: 30, fontSize: 16 },
  
  userCard: {
    backgroundColor: LIGHT_TEXT_COLOR,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  userCardBlocked: {
    backgroundColor: '#FADBD8', // Nền đỏ nhạt
    opacity: 0.7,
  },
  userIcon: {
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  userRole: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ACCENT_COLOR,
    marginTop: 2,
  },
  userRoleAdmin: {
    color: ERROR_COLOR,
  },
  userRoleBlocked: {
    color: ERROR_COLOR,
  },
  userActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
  },
});