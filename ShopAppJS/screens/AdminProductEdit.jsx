// screens/AdminProductEdit.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Định nghĩa màu
const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const TEXT_COLOR = '#333333';
const BORDER_COLOR = '#BDC3C7';
const INPUT_BG_COLOR = '#F5F5F5';

const API_URL = 'http://192.168.1.102:3000';

export default function AdminProductEdit({ route, navigation }) {
  // Lấy product từ params. Nếu là null, nghĩa là "Tạo mới"
  const { product } = route.params || { product: null };
  const isEditing = product !== null; // Kiểm tra xem đang Sửa hay Tạo

  const [name, setName] = useState(isEditing ? product.name : '');
  const [brand, setBrand] = useState(isEditing ? product.brand : '');
  const [price, setPrice] = useState(isEditing ? product.price.toString() : '');
  const [discount, setDiscount] = useState(isEditing ? product.discount.toString() : '0');
  const [imageUrl, setImageUrl] = useState(isEditing ? product.image_url : '');
  const [description, setDescription] = useState(isEditing ? product.description : '');
  const [sizes, setSizes] = useState(isEditing ? product.sizes.join(', ') : ''); // Chuyển mảng thành chuỗi
  
  const [loading, setLoading] = useState(false);

  // Lấy Token
  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return token;
  }, [navigation]);

  // Xử lý Lưu
  const handleSave = async () => {
    if (!name || !brand || !price || !imageUrl) {
      Alert.alert('Lỗi', 'Vui lòng điền các trường bắt buộc (Tên, Hãng, Giá, URL Ảnh)');
      return;
    }
    
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) return;

      const productData = {
        name,
        brand,
        price: parseFloat(price),
        discount: parseFloat(discount),
        image_url: imageUrl,
        description,
        sizes: sizes.split(',').map(s => s.trim()), // Chuyển chuỗi thành mảng
        category: brand, // Tạm thời dùng brand làm category
      };
      
      const url = isEditing 
        ? `${API_URL}/api/admin/products/${product.id}` // Sửa (PUT)
        : `${API_URL}/api/admin/products`; // Tạo (POST)
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      
      const data = await res.json();

      if (res.ok) {
        Alert.alert('Thành công', `Đã ${isEditing ? 'cập nhật' : 'tạo mới'} sản phẩm.`);
        navigation.goBack(); // Quay lại trang danh sách
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Lưu thất bại.');
    } finally {
      setLoading(false);
    }
  };

  // Render Input
  const renderInput = (label, value, onChangeText, keyboardType = 'default') => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={label}
        placeholderTextColor="#999"
      />
    </View>
  );

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {renderInput("Tên Sản phẩm*", name, setName)}
        {renderInput("Hãng (Brand)*", brand, setBrand)}
        {renderInput("Giá (VNĐ)*", price, setPrice, 'numeric')}
        {renderInput("Giảm giá (%)", discount, setDiscount, 'numeric')}
        {renderInput("Link Ảnh (URL)*", imageUrl, setImageUrl)}
        {renderInput("Sizes (Phân cách bởi dấu phẩy, vd: 39, 40, 41)", sizes, setSizes)}
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả chi tiết sản phẩm"
            placeholderTextColor="#999"
            multiline
          />
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={LIGHT_TEXT_COLOR} />
          ) : (
            <Text style={styles.saveButtonText}>LƯU SẢN PHẨM</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    backgroundColor: PRIMARY_COLOR,
  },
  backButton: { padding: 5, marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  scrollContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    backgroundColor: INPUT_BG_COLOR,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: ACCENT_COLOR,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
});