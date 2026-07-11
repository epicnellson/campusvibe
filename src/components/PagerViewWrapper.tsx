import { Children, ReactNode, forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";

export interface PagerViewRef {
  setPage: (index: number) => void;
}

export const SwipeablePager = forwardRef<PagerViewRef, {
  children: ReactNode;
  activeIndex: number;
  onPageChange: (index: number) => void;
}>(({ children, activeIndex, onPageChange }, ref) => {
  useImperativeHandle(ref, () => ({
    setPage: (index: number) => onPageChange(index),
  }));

  const childArray = Children.toArray(children);
  return (
    <View style={{ flex: 1 }}>
      {childArray.map((child, index) => (
        <View
          key={(child as any).key ?? index}
          style={[
            { flex: 1, position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
            index !== activeIndex && { display: "none" },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
});
