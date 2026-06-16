use anyhow::Result;
use windows::Win32::Media::Audio::{
    eCapture, eMultimedia, eRender, IMMDevice, IMMDeviceCollection, IMMDeviceEnumerator,
    MMDeviceEnumerator, DEVICE_STATE_ACTIVE, EDataFlow,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, CoCreateInstance, CoInitializeEx, COINIT_APARTMENTTHREADED, CoTaskMemFree, STGM_READ,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use crate::models::AudioDeviceInfo;

fn get_device_name(device: &IMMDevice) -> Result<String> {
    unsafe {
        let store = device.OpenPropertyStore(STGM_READ)?;
        let propvar = store.GetValue(&PKEY_Device_FriendlyName)?;
        let pwstr = PropVariantToStringAlloc(&propvar)?;
        let name = if pwstr.0.is_null() {
            String::new()
        } else {
            let len = (0..).take_while(|&i| *pwstr.0.offset(i) != 0).count();
            let slice = std::slice::from_raw_parts(pwstr.0, len);
            String::from_utf16_lossy(slice)
        };
        CoTaskMemFree(Some(pwstr.0 as *const _));
        Ok(name)
    }
}

fn get_device_id(device: &IMMDevice) -> Result<String> {
    unsafe {
        let id = device.GetId()?;
        if id.0.is_null() {
            return Ok(String::new());
        }
        let len = (0..).take_while(|&i| *id.0.offset(i) != 0).count();
        let slice = std::slice::from_raw_parts(id.0, len);
        let s = String::from_utf16_lossy(slice);
        CoTaskMemFree(Some(id.0 as *const _));
        Ok(s)
    }
}

fn list_devices_of_type(data_flow: EDataFlow) -> Result<Vec<AudioDeviceInfo>> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok();
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let collection: IMMDeviceCollection = enumerator.EnumAudioEndpoints(data_flow, DEVICE_STATE_ACTIVE)?;
        let count = collection.GetCount()?;
        let mut devices = vec![];
        let device_type = if data_flow == eRender { "output" } else { "input" };

        let default_device: Option<IMMDevice> = enumerator.GetDefaultAudioEndpoint(data_flow, eMultimedia).ok();
        let mut default_id = None;
        if let Some(ref d) = default_device {
            default_id = get_device_id(d).ok();
        }

        for i in 0..count {
            let device: IMMDevice = collection.Item(i)?;
            let id = get_device_id(&device)?;
            let name = get_device_name(&device)?;
            devices.push(AudioDeviceInfo {
                id: id.clone(),
                name,
                is_default: default_id.as_ref() == Some(&id),
                device_type: device_type.to_string(),
            });
        }
        Ok(devices)
    }
}

pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>> {
    let mut all = vec![];
    all.extend(list_devices_of_type(eCapture)?);
    all.extend(list_devices_of_type(eRender)?);
    Ok(all)
}
