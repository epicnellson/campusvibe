import { ReactNode, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

export interface PagerViewRef {
  setPage: (index: number) => void;
}

export const SwipeablePager = forwardRef<PagerViewRef, {
  children: ReactNode;
  activeIndex: number;
  onPageChange: (index: number) => void;
}>(({ children, activeIndex, onPageChange }, ref) => {
  const pagerRef = useRef<PagerView>(null);
  useImperativeHandle(ref, () => ({
    setPage: (index: number) => pagerRef.current?.setPage(index),
  }));

  const onPageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    onPageChange(e.nativeEvent.position);
  }, [onPageChange]);

  return (
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={activeIndex}
      onPageSelected={onPageSelected}
    >
      {children}
    </PagerView>
  );
});

const styles = StyleSheet.create({
  pager: { flex: 1 },
});
