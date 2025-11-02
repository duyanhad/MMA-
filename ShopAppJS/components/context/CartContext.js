// context/CartContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Khởi tạo ---
const CartContext = createContext();
const CART_STORAGE_KEY = 'my-app-cart';

// --- Định nghĩa Reducer (Bộ xử lý logic) ---
function cartReducer(state, action) {
  let newCart = [];
  switch (action.type) {
    // --- Thêm sản phẩm ---
    case 'ADD_TO_CART':
      const item = action.payload;
      const existingItemIndex = state.cartItems.findIndex(
        (i) => i.id === item.id && i.selectedSize === item.selectedSize
      );

      if (existingItemIndex > -1) {
        // Nếu có, chỉ tăng số lượng
        newCart = [...state.cartItems];
        newCart[existingItemIndex].quantity = (newCart[existingItemIndex].quantity || 1) + 1;
        return { ...state, cartItems: newCart };
      } else {
        // Nếu chưa, thêm mới với số lượng là 1
        return {
          ...state,
          cartItems: [...state.cartItems, { ...item, quantity: 1 }],
        };
      }

    // --- Xóa sản phẩm ---
    case 'REMOVE_FROM_CART':
      newCart = state.cartItems.filter(
        (i) => !(i.id === action.payload.id && i.selectedSize === action.payload.selectedSize)
      );
      return { ...state, cartItems: newCart };

    // --- Tăng số lượng ---
    case 'INCREASE_QUANTITY':
      newCart = state.cartItems.map((i) =>
        i.id === action.payload.id && i.selectedSize === action.payload.selectedSize
          ? { ...i, quantity: i.quantity + 1 }
          : i
      );
      return { ...state, cartItems: newCart };

    // --- Giảm số lượng ---
    case 'DECREASE_QUANTITY':
      newCart = state.cartItems
        .map((i) =>
          i.id === action.payload.id && i.selectedSize === action.payload.selectedSize
            ? { ...i, quantity: i.quantity - 1 }
            : i
        )
        .filter((i) => i.quantity > 0); // Lọc luôn nếu số lượng về 0
      return { ...state, cartItems: newCart };

    // --- Load giỏ hàng từ Async Storage ---
    case 'LOAD_CART':
      return { ...state, cartItems: action.payload, isLoaded: true };
    
    // --- Xóa sạch giỏ hàng (sau khi thanh toán) ---
    case 'CLEAR_CART':
        return { ...state, cartItems: [] };

    default:
      return state;
  }
}

// --- Tạo Provider (Component "bọc" ứng dụng) ---
// TỪ KHÓA 'export' NÀY LÀ QUAN TRỌNG NHẤT ĐỂ SỬA LỖI
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, {
    cartItems: [],
    isLoaded: false, 
  });

  // 1. Load giỏ hàng từ AsyncStorage khi app khởi động
  useEffect(() => {
    async function loadCartData() {
      try {
        const data = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (data) {
          dispatch({ type: 'LOAD_CART', payload: JSON.parse(data) });
        } else {
          dispatch({ type: 'LOAD_CART', payload: [] }); 
        }
      } catch (e) {
        console.error('Failed to load cart from storage', e);
        dispatch({ type: 'LOAD_CART', payload: [] });
      }
    }
    loadCartData();
  }, []);

  // 2. Lưu giỏ hàng vào AsyncStorage mỗi khi state.cartItems thay đổi
  useEffect(() => {
    if (state.isLoaded) {
      async function saveCartData() {
        try {
          await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cartItems));
        } catch (e) {
          console.error('Failed to save cart to storage', e);
        }
      }
      saveCartData();
    }
  }, [state.cartItems, state.isLoaded]);

  // Các hàm để các component khác gọi
  const addToCart = (item) => dispatch({ type: 'ADD_TO_CART', payload: item });
  const removeFromCart = (id, selectedSize) =>
    dispatch({ type: 'REMOVE_FROM_CART', payload: { id, selectedSize } });
  const increaseQuantity = (id, selectedSize) =>
    dispatch({ type: 'INCREASE_QUANTITY', payload: { id, selectedSize } });
  const decreaseQuantity = (id, selectedSize) =>
    dispatch({ type: 'DECREASE_QUANTITY', payload: { id, selectedSize } });
  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  return (
    <CartContext.Provider
      value={{
        cartItems: state.cartItems,
        isCartLoaded: state.isLoaded,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// --- Tạo Custom Hook (để tiện sử dụng) ---
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}