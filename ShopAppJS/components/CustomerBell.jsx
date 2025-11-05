// components/CustomerBell.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.102:3000';

export default function CustomerBell({ user, navigation }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);      // {id, order_code, status, total_amount, created_at}
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = s;

    // vào room riêng user-<id>
    s.on('connect', () => s.emit('registerUser', user.id));

    // nhận thông báo tạo đơn
    s.on('userOrderCreated', (n) => {
      setList((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    });

    // nhận thông báo cập nhật trạng thái
    s.on('userOrderUpdated', (n) => {
      setList((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    });

    return () => s.disconnect();
  }, [user?.id]);

  const toggle = () => {
    setOpen((v) => {
      const nv = !v;
      if (nv) setUnread(0);
      return nv;
    });
  };

  const gotoOrder = (n) => {
    setOpen(false);
    navigation.navigate('OrderDetail', { order: n });
  };

  // vị trí panel ngay dưới thanh top (fix cứng, dễ chỉnh)
  const PANEL_TOP =
    (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 58 : 92);

  return (
    <>
      {/* Nút chuông */}
      <TouchableOpacity onPress={toggle} style={styles.bellBtn}>
        <Ionicons
          name={unread > 0 ? 'notifications' : 'notifications-outline'}
          size={24}
          color="#fff"
        />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown dùng Modal để luôn nổi lên trên */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* lớp tối khóa nền, bấm để đóng */}
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        {/* panel cố định góc phải */}
        <View style={[styles.panel, { top: PANEL_TOP }]}>
          <Text style={styles.panelTitle}>Thông báo</Text>

          {list.length === 0 ? (
            <Text style={styles.empty}>Chưa có thông báo.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {list.map((n, idx) => (
                <TouchableOpacity key={idx} style={styles.item} onPress={() => gotoOrder(n)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemMain}>
                      #{n.order_code} • {n.status || 'Pending'}
                    </Text>
                    <Text style={styles.itemSub}>
                      Tổng: {(n.total_amount || 0).toLocaleString('vi-VN')} đ
                    </Text>
                    <Text style={styles.itemSub}>
                      {new Date(n.created_at).toLocaleString('vi-VN')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: { padding: 6 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF5C5C',
    borderRadius: 9,
    height: 18,
    minWidth: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Modal layers
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    position: 'absolute',
    right: 10,
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 30,   // Android
  },
  panelTitle: {
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    fontSize: 16,
  },
  empty: { color: '#64748B', paddingVertical: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  itemMain: { color: '#0F172A', fontWeight: '600' },
  itemSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
});
