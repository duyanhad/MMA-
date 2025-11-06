// screens/LoginScreen.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator, 
} from 'react-native';
import CustomInput from '../components/CustomInput';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { CommonActions } from '@react-navigation/native'; 

// 🚨 LƯU Ý: Đảm bảo IP này khớp
// const API_URL = 'http://192.168.1.103:3000';
const API_URL = 'https://mma-3kpy.onrender.com';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); 

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (res.ok && data.token && data.user) { 
        // Lưu token và thông tin người dùng
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.user)); 
        
        // Kiểm tra role để điều hướng
        if (data.user.role === 'admin') {
          Alert.alert('Thành công', `Chào mừng Admin ${data.user.name}!`);
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'AdminDashboard' }], 
            })
          );
        } else {
          Alert.alert('Thành công', `Chào mừng ${data.user.name} trở lại!`);
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Home' }], 
            })
          );
        }
        
      } else {
        Alert.alert('Lỗi', data.message || 'Email hoặc mật khẩu không đúng');
      }
    } catch (error) {
      console.error('Lỗi đăng nhập:', error); // Giữ lại log này để kiểm tra lỗi "Network request failed"
      Alert.alert('Lỗi Mạng', 'Không thể kết nối đến máy chủ. Hãy kiểm tra IP và backend server.');
    } finally {
      setLoading(false); 
    }
  };

  return (
    <LinearGradient
      colors={['#2c3e50', '#34495e']}
      style={styles.background}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          
          {/* 🚀 SỬA LỖI CÚ PHÁP Ở ĐÂY (bỏ 1 dấu ' ở đầu uri) */}
          <Image 
            source={{ uri: 'https://pos.nvncdn.com/c47d80-44932/store/20230311_c3qYR3MY.jpg?v=1678520204' }} 
            style={styles.logo}
          />

          <Text style={styles.title}>Đăng Nhập</Text>
          
          <CustomInput 
            value={email}
            onChangeText={setEmail} 
            placeholder="Email"
            iconName="mail-outline"
            keyboardType="email-address"
          />
          
          <CustomInput 
            value={password}
            onChangeText={setPassword}
            placeholder="Mật khẩu"
            secureTextEntry={true}
            iconName="lock-closed-outline"
          />
          
          <TouchableOpacity 
            onPress={handleLogin} 
            style={styles.button} 
            activeOpacity={0.8}
            disabled={loading}
          >
            <LinearGradient
              colors={['#3498DB', '#2980B9']}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Đăng Nhập</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
            <Text style={styles.link}>Chưa có tài khoản? Đăng ký ngay</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// (Styles giữ nguyên)
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 50,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    borderRadius: 70,
    marginBottom: 25,
    borderWidth: 3,
    borderColor: '#fff',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {},
  buttonGradient: {
    borderRadius: 30,
    marginTop: 15,
    marginBottom: 25,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#e0f7fa',
    textAlign: 'center',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});