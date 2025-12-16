#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// WiFi credentials
const char *ssid = "Wokwi-GUEST";
const char *password = "";

// MQTT Broker
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

// MQTT Topics
const char *topic_sensor_data = "agrismart/sensors";
const char *topic_motor_control = "agrismart/motor/control";
const char *topic_motor_status = "agrismart/motor/status";
const char *topic_crop_config = "agrismart/crop/config";
const char *topic_manual_override = "agrismart/manual/override";

// Pin Definitions
#define DHTPIN 15
#define DHTTYPE DHT22
#define SOIL_MOISTURE_PIN 34
#define RELAY_PIN 26
#define LED_WIFI 2
#define LED_MOTOR 4

// Initialize DHT sensor
DHT dht(DHTPIN, DHTTYPE);

// Variables
float temperature = 0;
float humidity = 0;
int soilMoisture = 0;
bool motorStatus = false;
bool manualMode = false;

// Crop Profile Structure
struct CropProfile
{
    const char *name;
    int minMoisture;
    int maxMoisture;
    float minTemp;
    float maxTemp;
    const char *tips;
};

// Current Crop
CropProfile currentCrop = {
    "Tomato", 40, 70, 20.0, 30.0,
    "Water early morning or evening. Avoid wetting leaves."};

// Available Crops
CropProfile crops[] = {
    {"Tomato", 40, 70, 20.0, 30.0, "Water early morning. Avoid wetting leaves."},
    {"Rice", 70, 90, 25.0, 35.0, "Needs standing water. High moisture required."},
    {"Wheat", 30, 60, 15.0, 25.0, "Moderate water. Drought-resistant."},
    {"Potato", 50, 75, 15.0, 25.0, "Consistent moisture. Avoid waterlogging."},
    {"Chilli", 35, 65, 20.0, 30.0, "Less water than tomato. Well-drained soil."},
    {"Sugarcane", 65, 85, 25.0, 35.0, "High water requirement. Tropical crop."},
    {"Cotton", 30, 60, 20.0, 35.0, "Moderate water. Drought-tolerant."},
    {"Lettuce", 60, 80, 15.0, 25.0, "High moisture for leafy growth."}};

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastSensorRead = 0;
const long sensorInterval = 5000;

// Function prototypes
void setupWiFi();
void reconnectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void readSensors();
void automaticIrrigation();
void controlMotor(bool status);
void publishSensorData();
void publishStatus(const char *message);
void changeCropProfile(const char *cropName);

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=================================");
    Serial.println("  AgriSmart IoT System v1.0");
    Serial.println("=================================\n");

    // Initialize pins
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_WIFI, OUTPUT);
    pinMode(LED_MOTOR, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_WIFI, LOW);
    digitalWrite(LED_MOTOR, LOW);

    // Initialize DHT
    dht.begin();

    // Connect WiFi
    setupWiFi();

    // Setup MQTT
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);

    Serial.println("AgriSmart ESP32 Ready!");
    Serial.print("Current Crop: ");
    Serial.println(currentCrop.name);
    Serial.print("Moisture Range: ");
    Serial.print(currentCrop.minMoisture);
    Serial.print("% - ");
    Serial.print(currentCrop.maxMoisture);
    Serial.println("%\n");
}

void setupWiFi()
{
    Serial.print("Connecting to WiFi...");
    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        digitalWrite(LED_WIFI, !digitalRead(LED_WIFI));
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        digitalWrite(LED_WIFI, HIGH);
        Serial.println("\nWiFi Connected!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("\nWiFi Failed!");
    }
}

void reconnectMQTT()
{
    int attempts = 0;
    while (!client.connected() && attempts < 3)
    {
        Serial.print("Connecting to MQTT...");

        String clientId = "ESP32_AgriSmart_";
        clientId += String(random(0xffff), HEX);

        if (client.connect(clientId.c_str()))
        {
            Serial.println("Connected!");

            client.subscribe(topic_motor_control);
            client.subscribe(topic_crop_config);
            client.subscribe(topic_manual_override);

            publishStatus("ESP32 Connected");
        }
        else
        {
            Serial.print("Failed, rc=");
            Serial.println(client.state());
            delay(2000);
            attempts++;
        }
    }
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    char message[length + 1];
    for (unsigned int i = 0; i < length; i++)
    {
        message[i] = (char)payload[i];
    }
    message[length] = '\0';

    Serial.print("Received on ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(message);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error)
    {
        Serial.print("JSON parse failed: ");
        Serial.println(error.c_str());
        return;
    }

    // Motor Control
    if (strcmp(topic, topic_motor_control) == 0)
    {
        if (doc.containsKey("status"))
        {
            bool cmd = doc["status"];
            if (doc.containsKey("manual"))
            {
                manualMode = doc["manual"];
            }
            if (manualMode)
            {
                controlMotor(cmd);
                publishStatus(cmd ? "Motor ON (Manual)" : "Motor OFF (Manual)");
            }
        }
    }

    // Crop Change
    if (strcmp(topic, topic_crop_config) == 0)
    {
        if (doc.containsKey("crop"))
        {
            const char *crop = doc["crop"];
            changeCropProfile(crop);
        }
    }

    // Manual Override
    if (strcmp(topic, topic_manual_override) == 0)
    {
        if (doc.containsKey("enabled"))
        {
            manualMode = doc["enabled"];
            Serial.print("Manual Mode: ");
            Serial.println(manualMode ? "ON" : "OFF");
            if (!manualMode)
            {
                publishStatus("Auto mode enabled");
            }
        }
    }
}

void loop()
{
    if (!client.connected())
    {
        reconnectMQTT();
    }
    client.loop();

    unsigned long now = millis();
    if (now - lastSensorRead >= sensorInterval)
    {
        lastSensorRead = now;

        readSensors();
        publishSensorData();

        if (!manualMode)
        {
            automaticIrrigation();
        }
    }
}

void readSensors()
{
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    int raw = analogRead(SOIL_MOISTURE_PIN);
    soilMoisture = map(raw, 4095, 1000, 0, 100);
    soilMoisture = constrain(soilMoisture, 0, 100);

    if (isnan(temperature) || isnan(humidity))
    {
        temperature = 0;
        humidity = 0;
    }

    Serial.println("\n========== SENSORS ==========");
    Serial.print("Crop: ");
    Serial.println(currentCrop.name);
    Serial.print("Temp: ");
    Serial.print(temperature);
    Serial.println("C");
    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println("%");
    Serial.print("Moisture: ");
    Serial.print(soilMoisture);
    Serial.println("%");
    Serial.print("Motor: ");
    Serial.println(motorStatus ? "ON" : "OFF");
    Serial.print("Mode: ");
    Serial.println(manualMode ? "MANUAL" : "AUTO");
    Serial.println("=============================\n");
}

void automaticIrrigation()
{
    if (soilMoisture < currentCrop.minMoisture && !motorStatus)
    {
        Serial.println("LOW MOISTURE - Starting irrigation");
        controlMotor(true);
        publishStatus("Irrigation started");
    }
    else if (soilMoisture > currentCrop.maxMoisture && motorStatus)
    {
        Serial.println("OPTIMAL MOISTURE - Stopping irrigation");
        controlMotor(false);
        publishStatus("Irrigation stopped");
    }

    if (temperature > currentCrop.maxTemp)
    {
        Serial.println("WARNING: High temperature");
    }
    if (temperature < currentCrop.minTemp && temperature > 0)
    {
        Serial.println("WARNING: Low temperature");
    }
}

void controlMotor(bool status)
{
    motorStatus = status;
    digitalWrite(RELAY_PIN, status ? HIGH : LOW);
    digitalWrite(LED_MOTOR, status ? HIGH : LOW);

    StaticJsonDocument<200> doc;
    doc["motor"] = status;
    doc["timestamp"] = millis();
    doc["mode"] = manualMode ? "manual" : "auto";

    char buffer[200];
    serializeJson(doc, buffer);
    client.publish(topic_motor_status, buffer);
}

void publishSensorData()
{
    StaticJsonDocument<600> doc;

    doc["deviceId"] = "ESP32_001";
    doc["crop"] = currentCrop.name;
    doc["temperature"] = (int)(temperature * 10) / 10.0;
    doc["humidity"] = (int)(humidity * 10) / 10.0;
    doc["moisture"] = soilMoisture;
    doc["motorStatus"] = motorStatus;
    doc["manualMode"] = manualMode;
    doc["timestamp"] = millis();

    JsonObject thresh = doc.createNestedObject("thresholds");
    thresh["minMoisture"] = currentCrop.minMoisture;
    thresh["maxMoisture"] = currentCrop.maxMoisture;
    thresh["minTemp"] = currentCrop.minTemp;
    thresh["maxTemp"] = currentCrop.maxTemp;

    char buffer[600];
    serializeJson(doc, buffer);

    if (client.publish(topic_sensor_data, buffer))
    {
        Serial.println("Data published");
    }
    else
    {
        Serial.println("Publish failed");
    }
}

void publishStatus(const char *message)
{
    StaticJsonDocument<200> doc;
    doc["status"] = message;
    doc["timestamp"] = millis();
    doc["deviceId"] = "ESP32_001";

    char buffer[200];
    serializeJson(doc, buffer);
    client.publish("agrismart/status", buffer);
}

void changeCropProfile(const char *cropName)
{
    int numCrops = sizeof(crops) / sizeof(crops[0]);

    for (int i = 0; i < numCrops; i++)
    {
        // Simple comparison without strcasecmp
        bool match = true;
        int j = 0;
        while (crops[i].name[j] != '\0' && cropName[j] != '\0')
        {
            char c1 = crops[i].name[j];
            char c2 = cropName[j];
            // Convert to lowercase for comparison
            if (c1 >= 'A' && c1 <= 'Z')
                c1 = c1 + 32;
            if (c2 >= 'A' && c2 <= 'Z')
                c2 = c2 + 32;
            if (c1 != c2)
            {
                match = false;
                break;
            }
            j++;
        }
        if (match && crops[i].name[j] == '\0' && cropName[j] == '\0')
        {
            currentCrop = crops[i];

            Serial.println("\nCROP CHANGED:");
            Serial.println(currentCrop.name);
            Serial.print("Moisture: ");
            Serial.print(currentCrop.minMoisture);
            Serial.print("% - ");
            Serial.print(currentCrop.maxMoisture);
            Serial.println("%");

            publishStatus("Crop changed");
            readSensors();
            publishSensorData();
            return;
        }
    }

    Serial.println("Crop not found");
    publishStatus("Crop not found");
}