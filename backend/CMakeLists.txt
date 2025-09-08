cmake_minimum_required(VERSION 3.15)
set(CMAKE_TOOLCHAIN_FILE "${CMAKE_CURRENT_SOURCE_DIR}/vcpkg/scripts/buildsystems/vcpkg.cmake" CACHE STRING "Vcpkg toolchain file")
project(gesture_detector)
set(CMAKE_CXX_STANDARD 17)

find_package(OpenCV REQUIRED)
add_executable(gesture_detector gesture_detector.cpp)
target_link_libraries(gesture_detector PRIVATE ${OpenCV_LIBS})
