// screens/RegisterScreen.jsx
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
} from 'react-native';
import CustomInput from '../components/CustomInput';
import { LinearGradient } from 'expo-linear-gradient';

// 1. SỬA LỖI IP Ở ĐÂY
const API_URL = 'http://192.168.1.103:3000';

// 2. Phải là "export default"
export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }
    try {
      // 3. Sửa fetch URL
      const res = await fetch(`${API_URL}/auth/register`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) { 
        Alert.alert('Thành công', 'Đăng ký thành công! Vui lòng đăng nhập.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Lỗi', data.message || 'Đăng ký thất bại. Email có thể đã tồn tại.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Lỗi kết nối server. Vui lòng kiểm tra lại mạng.');
    }
  };

  return (
    <LinearGradient colors={['#0f2027', '#203a43', '#2c5364']} style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.background}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Image
            source={{ uri: 'https://pos.nvncdn.com/c47d80-44932/store/20230311_c3qYR3MY.jpg?v=1678520204' }} // Thay bằng ảnh logo của bạn nếu có
            style={styles.logo}
          />
          <Text style={styles.title}>ĐĂNG KÝ</Text>

          <CustomInput
            placeholder="Tên của bạn"
            iconName="person-outline"
            value={name}
            setValue={setName}
          />
          <CustomInput
            placeholder="Email"
            iconName="mail-outline"
            value={email}
            setValue={setEmail}
          />
          <CustomInput
            placeholder="Mật khẩu"
            iconName="lock-outline"
            value={password}
            setValue={setPassword}
            secureTextEntry
          />

          {/* Register Button */}
          <TouchableOpacity onPress={handleRegister} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF6F61', '#FF9A8B']}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>ĐĂNG KÝ</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
// (Copy toàn bộ Styles từ file RegisterScreen.jsx cũ của bạn vào đây)
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
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  buttonGradient: {
    borderRadius: 30,
    marginTop: 15,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
});