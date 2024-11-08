import React, { useEffect, useState } from "react";
import { View, Text, Button, TextInput, Alert } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import axios from "axios";

const LOCATION_TASK_NAME = "background-location-task";

const HomeScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [serverUrl, setServerUrl] = useState<string>("");
  const [isTracking, setIsTracking] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permissions are required!");
        return;
      }

      if (isTracking) {
        await startLocationTracking();
      } else {
        await stopLocationTracking();
      }
    })();

    return () => {
      stopLocationTracking();
    };
  }, [isTracking]);

  const startLocationTracking = async () => {
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
      },
      (newLocation) => {
        setLocation(newLocation);
        sendLocationToServer(newLocation);
      }
    );

    await startBackgroundTask();
  };

  const stopLocationTracking = async () => {
    //@ts-ignore
    await Location.stopLocationUpdatesAsync();
    await BackgroundFetch.unregisterTaskAsync(LOCATION_TASK_NAME);
  };

  const startBackgroundTask = async () => {
    await BackgroundFetch.registerTaskAsync(LOCATION_TASK_NAME, {
      minimumInterval: 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  };

  const sendLocationToServer = async (location: Location.LocationObject) => {
    if (!serverUrl) return;

    try {
      await axios.post(serverUrl, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      });
      sendPushNotification(
        "Location Sent",
        `Location sent to server: ${serverUrl}`
      );
    } catch (error) {
      console.error("Failed to send location:", error);
    }
  };

  const sendPushNotification = async (title: string, message: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
      },
      trigger: null,
    });
  };

  TaskManager.defineTask(LOCATION_TASK_NAME, async () => {
    const location = await Location.getCurrentPositionAsync({});
    sendLocationToServer(location);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  });

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text>Location Tracking App</Text>
      <TextInput
        style={{
          height: 40,
          borderColor: "gray",
          borderWidth: 1,
          marginBottom: 20,
        }}
        placeholder="Enter server URL"
        value={serverUrl}
        onChangeText={setServerUrl}
      />
      <Button
        title={isTracking ? "Stop Tracking" : "Start Tracking"}
        onPress={() => setIsTracking(!isTracking)}
      />
      {location && (
        <View style={{ marginTop: 20 }}>
          <Text>Latitude: {location.coords.latitude}</Text>
          <Text>Longitude: {location.coords.longitude}</Text>
        </View>
      )}
    </View>
  );
};

export default HomeScreen;
